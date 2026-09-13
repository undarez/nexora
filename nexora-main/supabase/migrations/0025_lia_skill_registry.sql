-- v4.54: governed, versioned skill registry for LIA.
-- Skills are procedural memory. Discovery is read-only; creation is candidate-only.
-- Activation is never performed by the LLM.

create table if not exists public.lia_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  scope text not null default 'global' check (scope in ('global','user')),
  slug text not null,
  name text not null,
  description text not null,
  category text not null default 'general',
  status text not null default 'candidate' check (status in ('candidate','validated','active','deprecated','rejected')),
  source_type text not null check (source_type in ('system','user_provided','agent_generated','corrected')),
  trust_score integer not null default 0 check (trust_score between 0 and 100),
  use_count integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  last_validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(scope,user_id,slug)
);

create index if not exists idx_lia_skills_discovery
  on public.lia_skills(status,category,trust_score desc,updated_at desc);

create table if not exists public.lia_skill_versions (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.lia_skills(id) on delete cascade,
  version integer not null,
  content text not null,
  content_hash text not null,
  trigger_context jsonb not null default '{}'::jsonb,
  expected_result text,
  verification_steps jsonb not null default '[]'::jsonb,
  failure_modes jsonb not null default '[]'::jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  memory_gate jsonb not null default '{}'::jsonb,
  created_by text not null check (created_by in ('system','user','agent')),
  created_at timestamptz not null default now(),
  unique(skill_id,version),
  unique(skill_id,content_hash)
);

create index if not exists idx_lia_skill_versions_skill
  on public.lia_skill_versions(skill_id,version desc);

create table if not exists public.lia_skill_events (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid references public.lia_skills(id) on delete set null,
  skill_version_id uuid references public.lia_skill_versions(id) on delete set null,
  user_id uuid references auth.users(id) on delete cascade,
  event text not null check (event in ('created','used','succeeded','failed','corrected','validated','activated','deprecated','rejected')),
  actor text not null check (actor in ('system','user','agent','admin')),
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_lia_skill_events_skill_time on public.lia_skill_events(skill_id,created_at desc);

alter table public.lia_skills enable row level security;
alter table public.lia_skill_versions enable row level security;
alter table public.lia_skill_events enable row level security;

create policy "users read own skills" on public.lia_skills
  for select to authenticated using (scope='global' or user_id=auth.uid());
create policy "users read own skill versions" on public.lia_skill_versions
  for select to authenticated using (exists(select 1 from public.lia_skills s where s.id=skill_id and (s.scope='global' or s.user_id=auth.uid())));
create policy "users read own skill events" on public.lia_skill_events
  for select to authenticated using (user_id=auth.uid() or user_id is null);
revoke insert,update,delete on public.lia_skills from anon,authenticated;
revoke insert,update,delete on public.lia_skill_versions from anon,authenticated;
revoke insert,update,delete on public.lia_skill_events from anon,authenticated;

-- Candidate creation: service role only. Activation/validation is a separate privileged operation.
create or replace function public.lia_create_skill_candidate(
  p_user_id uuid,
  p_scope text,
  p_slug text,
  p_name text,
  p_description text,
  p_category text,
  p_source_type text,
  p_content text,
  p_trigger_context jsonb default '{}'::jsonb,
  p_expected_result text default null,
  p_verification_steps jsonb default '[]'::jsonb,
  p_failure_modes jsonb default '[]'::jsonb,
  p_source_refs jsonb default '[]'::jsonb,
  p_memory_gate jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_skill uuid; v_version uuid;
begin
  if p_scope not in ('global','user') then raise exception 'invalid_scope'; end if;
  if p_source_type not in ('system','user_provided','agent_generated','corrected') then raise exception 'invalid_source_type'; end if;
  if p_content is null or length(trim(p_content)) < 20 then raise exception 'skill_content_too_short'; end if;

  insert into public.lia_skills(user_id,scope,slug,name,description,category,status,source_type,trust_score)
  values(case when p_scope='user' then p_user_id else null end,p_scope,p_slug,p_name,p_description,p_category,'candidate',p_source_type,0)
  on conflict(scope,user_id,slug) do update set
    name=excluded.name, description=excluded.description, category=excluded.category,
    source_type=excluded.source_type, updated_at=now()
  returning id into v_skill;

  insert into public.lia_skill_versions(skill_id,version,content,content_hash,trigger_context,expected_result,verification_steps,failure_modes,source_refs,memory_gate,created_by)
  values(v_skill,coalesce((select max(version)+1 from public.lia_skill_versions where skill_id=v_skill),1),p_content,encode(digest(p_content,'sha256'),'hex'),p_trigger_context,p_expected_result,p_verification_steps,p_failure_modes,p_source_refs,p_memory_gate,'agent')
  on conflict(skill_id,content_hash) do update set memory_gate=excluded.memory_gate
  returning id into v_version;

  insert into public.lia_skill_events(skill_id,skill_version_id,user_id,event,actor,context)
  values(v_skill,v_version,p_user_id,'created','agent',jsonb_build_object('source_type',p_source_type));
  return v_skill;
end; $$;
revoke all on function public.lia_create_skill_candidate(uuid,text,text,text,text,text,text,text,jsonb,text,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.lia_create_skill_candidate(uuid,text,text,text,text,text,text,text,jsonb,text,jsonb,jsonb,jsonb,jsonb) to service_role;

-- Read-only retrieval used by the server agent runtime. Only validated/active skills are eligible.
create or replace function public.lia_search_skills(
  p_user_id uuid,
  p_query text,
  p_category text default null,
  p_limit integer default 8
) returns table(skill_id uuid, slug text, name text, description text, category text, status text, trust_score integer, version integer, content text)
language sql security definer set search_path=public,pg_temp as $$
  select s.id,s.slug,s.name,s.description,s.category,s.status,s.trust_score,v.version,v.content
  from public.lia_skills s
  join lateral (select sv.* from public.lia_skill_versions sv where sv.skill_id=s.id order by sv.version desc limit 1) v on true
  where (s.scope='global' or (s.scope='user' and s.user_id=p_user_id))
    and s.status in ('validated','active')
    and (p_category is null or s.category=p_category)
    and (coalesce(trim(p_query),'')='' or to_tsvector('simple',s.name||' '||s.description||' '||v.content) @@ plainto_tsquery('simple',p_query))
  order by case when s.status='active' then 0 else 1 end, s.trust_score desc, s.updated_at desc
  limit greatest(1,least(coalesce(p_limit,8),20));
$$;
revoke all on function public.lia_search_skills(uuid,text,text,integer) from public,anon;
grant execute on function public.lia_search_skills(uuid,text,text,integer) to authenticated,service_role;

-- Server-side validation/activation. The model can propose, never activate.
create or replace function public.lia_validate_skill(p_skill_id uuid,p_actor text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.lia_skills%rowtype; v public.lia_skill_versions%rowtype;
begin
  if p_actor not in ('user','admin','system') then raise exception 'invalid_actor'; end if;
  select * into s from public.lia_skills where id=p_skill_id for update;
  if not found then raise exception 'skill_not_found'; end if;
  select * into v from public.lia_skill_versions where skill_id=s.id order by version desc limit 1;
  if not found then raise exception 'skill_version_not_found'; end if;
  if coalesce((v.memory_gate->>'useful')::boolean,false)=false
     or coalesce((v.memory_gate->>'reliable')::boolean,false)=false
     or coalesce((v.memory_gate->>'reproducible')::boolean,false)=false then
    update public.lia_skills set status='rejected',updated_at=now() where id=s.id;
    insert into public.lia_skill_events(skill_id,skill_version_id,user_id,event,actor,context) values(s.id,v.id,s.user_id,'rejected',p_actor,jsonb_build_object('reason','memory_gate_failed'));
    return jsonb_build_object('validated',false,'reason','memory_gate_failed');
  end if;
  update public.lia_skills set status='validated',trust_score=greatest(trust_score,70),last_validated_at=now(),updated_at=now() where id=s.id;
  insert into public.lia_skill_events(skill_id,skill_version_id,user_id,event,actor,context) values(s.id,v.id,s.user_id,'validated',p_actor,'{}');
  return jsonb_build_object('validated',true,'skill_id',s.id);
end; $$;
revoke all on function public.lia_validate_skill(uuid,text) from public,anon,authenticated;
grant execute on function public.lia_validate_skill(uuid,text) to service_role;

create or replace function public.lia_activate_skill(p_skill_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.lia_skills%rowtype;
begin
  select * into s from public.lia_skills where id=p_skill_id for update;
  if not found then raise exception 'skill_not_found'; end if;
  if s.status <> 'validated' then raise exception 'skill_not_validated'; end if;
  update public.lia_skills set status='active',updated_at=now() where id=s.id;
  insert into public.lia_skill_events(skill_id,user_id,event,actor,context) values(s.id,s.user_id,'activated','admin','{}');
  return jsonb_build_object('activated',true,'skill_id',s.id);
end; $$;
revoke all on function public.lia_activate_skill(uuid) from public,anon,authenticated;
grant execute on function public.lia_activate_skill(uuid) to service_role;

-- Usage telemetry can only increase counters; it never promotes a skill.
create or replace function public.lia_record_skill_outcome(p_skill_id uuid,p_version integer,p_user_id uuid,p_success boolean,p_context jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  select id into v_id from public.lia_skill_versions where skill_id=p_skill_id and version=p_version;
  update public.lia_skills set use_count=use_count+1, success_count=success_count+case when p_success then 1 else 0 end, failure_count=failure_count+case when p_success then 0 else 1 end, updated_at=now() where id=p_skill_id;
  insert into public.lia_skill_events(skill_id,skill_version_id,user_id,event,actor,context) values(p_skill_id,v_id,p_user_id,case when p_success then 'succeeded' else 'failed' end,'agent',p_context);
end; $$;
revoke all on function public.lia_record_skill_outcome(uuid,integer,uuid,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.lia_record_skill_outcome(uuid,integer,uuid,boolean,jsonb) to service_role;
