-- V5.08.55: final Skill activation governance.
-- Activation is an explicit admin control-plane decision after governed promotion.
-- Rollback deactivates the current version or restores the immediately previous activation.

alter table public.lia_skills
  add column if not exists active_version_id uuid null references public.lia_skill_versions(id) on delete set null;

create table if not exists public.lia_skill_activations (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.lia_skills(id) on delete cascade,
  version_id uuid not null references public.lia_skill_versions(id) on delete cascade,
  previous_version_id uuid null references public.lia_skill_versions(id) on delete set null,
  activated_by uuid not null references auth.users(id) on delete restrict,
  activation_reason text not null check (char_length(trim(activation_reason)) between 10 and 2000),
  status text not null default 'active' check (status in ('active','rolled_back')),
  rolled_back_by uuid null references auth.users(id) on delete set null,
  rolled_back_at timestamptz null,
  rollback_reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_lia_skill_activations_skill_time on public.lia_skill_activations(skill_id,created_at desc);
create unique index if not exists idx_lia_skill_activations_one_active on public.lia_skill_activations(skill_id) where status='active';

alter table public.lia_skill_activations enable row level security;
revoke all on public.lia_skill_activations from public,anon,authenticated;
comment on table public.lia_skill_activations is 'Admin-only activation control plane. Explicit approval is required; model weights, policy, financial facts and permissions are never changed.';

-- Make the legacy service-role RPC fail closed so no caller can bypass the governed pipeline.
create or replace function public.lia_activate_skill(p_skill_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  raise exception 'activation_requires_governed_pipeline';
end; $$;
revoke all on function public.lia_activate_skill(uuid) from public,anon,authenticated;
grant execute on function public.lia_activate_skill(uuid) to service_role;

create or replace function public.lia_governed_activate_skill(p_skill_id uuid, p_actor uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  s public.lia_skills%rowtype;
  v public.lia_skill_versions%rowtype;
  r record;
  prev uuid;
begin
  if p_actor is null then raise exception 'activation_actor_required'; end if;
  if p_reason is null or char_length(trim(p_reason)) < 10 then raise exception 'activation_reason_required'; end if;

  select * into s from public.lia_skills where id=p_skill_id for update;
  if not found then raise exception 'skill_not_found'; end if;
  if s.status <> 'validated' then raise exception 'skill_not_validated'; end if;
  if s.trust_score < 70 then raise exception 'trust_score_below_threshold'; end if;

  select * into v from public.lia_skill_versions where id=s.active_version_id;
  if not found then
    select * into v from public.lia_skill_versions where skill_id=s.id order by version desc limit 1;
  end if;
  if not found then raise exception 'skill_version_not_found'; end if;
  if coalesce((v.memory_gate->>'useful')::boolean,false)=false
     or coalesce((v.memory_gate->>'reliable')::boolean,false)=false
     or coalesce((v.memory_gate->>'reproducible')::boolean,false)=false
     or coalesce((v.memory_gate->>'obsolete')::boolean,false)=true then
    raise exception 'memory_gate_failed';
  end if;

  -- Activation is only possible after the Learning Promotion Board has promoted this exact version.
  select 1 into r
  from public.lia_learning_review_board b
  where b.skill_id=s.id and b.skill_version_id=v.id and b.status='promoted'
  order by b.created_at desc limit 1;
  if not found then raise exception 'governed_promotion_missing'; end if;

  select a.version_id into prev
  from public.lia_skill_activations a
  where a.skill_id=s.id and a.status='active'
  order by a.created_at desc limit 1;

  if prev = v.id then
    raise exception 'skill_version_already_active';
  end if;

  update public.lia_skill_activations set status='rolled_back', rolled_back_by=p_actor, rolled_back_at=now(), rollback_reason='superseded_by_new_governed_activation' where skill_id=s.id and status='active';
  insert into public.lia_skill_activations(skill_id,version_id,previous_version_id,activated_by,activation_reason)
    values(s.id,v.id,prev,p_actor,trim(p_reason));
  update public.lia_skills set status='active',active_version_id=v.id,updated_at=now() where id=s.id;
  insert into public.lia_skill_events(skill_id,skill_version_id,user_id,event,actor,context)
    values(s.id,v.id,s.user_id,'activated','admin',jsonb_build_object('activation_reason',trim(p_reason),'previous_version_id',prev,'governed',true,'p_actor',p_actor));

  return jsonb_build_object('activated',true,'skill_id',s.id,'skill_version_id',v.id,'version',v.version,'status','active','previous_version_id',prev,'rollback_available',true);
end; $$;
revoke all on function public.lia_governed_activate_skill(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.lia_governed_activate_skill(uuid,uuid,text) to service_role;

create or replace function public.lia_governed_rollback_skill(p_skill_id uuid, p_actor uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.lia_skills%rowtype; a public.lia_skill_activations%rowtype;
begin
  if p_actor is null then raise exception 'rollback_actor_required'; end if;
  if p_reason is null or char_length(trim(p_reason)) < 10 then raise exception 'rollback_reason_required'; end if;
  select * into s from public.lia_skills where id=p_skill_id for update;
  if not found then raise exception 'skill_not_found'; end if;
  if s.status <> 'active' then raise exception 'skill_not_active'; end if;
  select * into a from public.lia_skill_activations where skill_id=s.id and status='active' order by created_at desc limit 1 for update;
  if not found then raise exception 'active_record_not_found'; end if;

  update public.lia_skill_activations set status='rolled_back',rolled_back_by=p_actor,rolled_back_at=now(),rollback_reason=trim(p_reason) where id=a.id;
  if a.previous_version_id is null then
    update public.lia_skills set status='validated',active_version_id=null,updated_at=now() where id=s.id;
  else
    update public.lia_skills set status='active',active_version_id=a.previous_version_id,updated_at=now() where id=s.id;
  end if;
  insert into public.lia_skill_events(skill_id,skill_version_id,user_id,event,actor,context)
    values(s.id,a.version_id,s.user_id,'deprecated','admin',jsonb_build_object('reason',trim(p_reason),'rollback',true,'restored_version_id',a.previous_version_id,'p_actor',p_actor));
  return jsonb_build_object('activated',false,'rollback',true,'skill_id',s.id,'restored_version_id',a.previous_version_id,'status',case when a.previous_version_id is null then 'validated' else 'active' end);
end; $$;
revoke all on function public.lia_governed_rollback_skill(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.lia_governed_rollback_skill(uuid,uuid,text) to service_role;

-- Active skills must expose the exact activated version, not silently drift to the latest candidate version.
create or replace function public.lia_search_skills(p_user_id uuid,p_query text,p_category text default null,p_limit integer default 8)
returns table(skill_id uuid,slug text,name text,description text,category text,status text,trust_score integer,version integer,content text)
language sql security definer set search_path=public,pg_temp as $$
  select s.id,s.slug,s.name,s.description,s.category,s.status,s.trust_score,v.version,v.content
  from public.lia_skills s
  join lateral (select sv.* from public.lia_skill_versions sv where sv.id=case when s.status='active' and s.active_version_id is not null then s.active_version_id else (select x.id from public.lia_skill_versions x where x.skill_id=s.id order by x.version desc limit 1) end limit 1) v on true
  where (s.scope='global' or (s.scope='user' and s.user_id=p_user_id))
    and s.status in ('validated','active')
    and (p_category is null or s.category=p_category)
    and (coalesce(trim(p_query),'')='' or to_tsvector('simple',s.name||' '||s.description||' '||v.content) @@ plainto_tsquery('simple',p_query))
  order by case when s.status='active' then 0 else 1 end,s.trust_score desc,s.updated_at desc
  limit greatest(1,least(coalesce(p_limit,8),20));
$$;
revoke all on function public.lia_search_skills(uuid,text,text,integer) from public,anon;
grant execute on function public.lia_search_skills(uuid,text,text,integer) to authenticated,service_role;
