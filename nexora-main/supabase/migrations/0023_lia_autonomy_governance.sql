-- v4.52: bounded LIA autonomy, human approval, reversible action proposals and audit.
create table if not exists public.lia_autonomy_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  max_autonomy_level integer not null default 1 check (max_autonomy_level between 0 and 8),
  updated_at timestamptz not null default now()
);
alter table public.lia_autonomy_profiles enable row level security;
create policy "users manage own autonomy profile" on public.lia_autonomy_profiles
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.lia_action_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id text not null,
  action_key text not null,
  title text not null,
  description text not null,
  risk_class text not null,
  autonomy_level integer not null check (autonomy_level between 0 and 8),
  reversible boolean not null default false,
  rollback_payload jsonb,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'proposed' check (status in ('proposed','approved','rejected','executed','rolled_back','expired')),
  approved_at timestamptz,
  executed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_lia_action_proposals_user_status on public.lia_action_proposals(user_id,status,created_at desc);
alter table public.lia_action_proposals enable row level security;
create policy "users read own action proposals" on public.lia_action_proposals for select to authenticated using (auth.uid() = user_id);
create policy "users can approve or reject own proposals" on public.lia_action_proposals for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke insert, delete on public.lia_action_proposals from authenticated;

create table if not exists public.lia_action_audit (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid references public.lia_action_proposals(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id text not null,
  event text not null,
  actor text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_lia_action_audit_user_time on public.lia_action_audit(user_id,created_at desc);
alter table public.lia_action_audit enable row level security;
create policy "users read own action audit" on public.lia_action_audit for select to authenticated using (auth.uid() = user_id);
revoke insert, update, delete on public.lia_action_audit from public, anon, authenticated;

create or replace function public.get_lia_autonomy(p_user_id uuid)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare v integer;
begin
  if p_user_id <> auth.uid() then raise exception 'forbidden'; end if;
  select max_autonomy_level into v from public.lia_autonomy_profiles where user_id=p_user_id;
  return coalesce(v,1);
end; $$;
revoke all on function public.get_lia_autonomy(uuid) from public,anon;
grant execute on function public.get_lia_autonomy(uuid) to authenticated;

create or replace function public.set_lia_autonomy(p_user_id uuid,p_level integer)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if p_user_id <> auth.uid() or p_level < 0 or p_level > 8 then raise exception 'forbidden'; end if;
  insert into public.lia_autonomy_profiles(user_id,max_autonomy_level) values(p_user_id,p_level)
  on conflict(user_id) do update set max_autonomy_level=excluded.max_autonomy_level,updated_at=now();
  return p_level;
end; $$;
revoke all on function public.set_lia_autonomy(uuid,integer) from public,anon;
grant execute on function public.set_lia_autonomy(uuid,integer) to authenticated;

create or replace function public.approve_lia_action(p_proposal_id uuid,p_decision text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.lia_action_proposals%rowtype; new_status text;
begin
  select * into p from public.lia_action_proposals where id=p_proposal_id and user_id=auth.uid() for update;
  if not found then raise exception 'proposal_not_found'; end if;
  if p.status <> 'proposed' or (p.expires_at is not null and p.expires_at < now()) then raise exception 'proposal_not_approvable'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'invalid_decision'; end if;
  new_status:=p_decision;
  update public.lia_action_proposals set status=new_status,approved_at=case when new_status='approved' then now() else null end where id=p.id;
  insert into public.lia_action_audit(proposal_id,user_id,agent_id,event,actor,metadata) values(p.id,p.user_id,p.agent_id,'approval', 'human', jsonb_build_object('decision',new_status));
  return jsonb_build_object('id',p.id,'status',new_status);
end; $$;
revoke all on function public.approve_lia_action(uuid,text) from public,anon;
grant execute on function public.approve_lia_action(uuid,text) to authenticated;

-- Replace the v4.50 gate so an agent can never exceed the user's configured autonomy ceiling.
create or replace function public.authorize_lia_tool(p_agent_id text,p_user_id uuid,p_organization_id text,p_tool_key text,p_autonomy_level integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare identity public.lia_agent_identities%rowtype; policy_row public.lia_tool_policies%rowtype; max_level integer:=1; allowed boolean:=false; reason text:='policy_denied';
begin
  if p_autonomy_level is null or p_autonomy_level < 0 or p_autonomy_level > 8 then reason:='invalid_autonomy_level';
  else
    select max_autonomy_level into max_level from public.lia_autonomy_profiles where user_id=p_user_id;
    max_level:=coalesce(max_level,1);
    if p_autonomy_level > max_level then reason:='autonomy_ceiling_exceeded';
    else
      select * into identity from public.lia_agent_identities where agent_id=p_agent_id and user_id=p_user_id and organization_id=p_organization_id and agent_key='lia' and role='financial_assistant' and enabled=true;
      if not found then reason:='agent_identity_denied';
      else
        select * into policy_row from public.lia_tool_policies where tool_key=p_tool_key and enabled=true;
        if not found then reason:='tool_policy_missing';
        elsif p_autonomy_level < policy_row.min_autonomy_level then reason:='autonomy_level_insufficient';
        elsif policy_row.human_approval_required then reason:='human_approval_required';
        else allowed:=true; reason:='allowed'; end if;
      end if;
    end if;
  end if;
  insert into public.lia_agent_policy_decisions(agent_id,user_id,organization_id,tool_key,autonomy_level,allowed,reason) values(p_agent_id,p_user_id,p_organization_id,p_tool_key,p_autonomy_level,allowed,reason);
  return jsonb_build_object('allowed',allowed,'reason',reason,'agent_id',p_agent_id,'tool_key',p_tool_key,'max_autonomy_level',max_level);
end; $$;
revoke all on function public.authorize_lia_tool(text,uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.authorize_lia_tool(text,uuid,text,text,integer) to service_role;

-- Client may only read proposals; all state transitions go through security-definer RPCs.
revoke update, insert, delete on public.lia_action_proposals from authenticated;

-- Proposal is intentionally reachable at autonomy L1: L1 means propose, not execute.
update public.lia_tool_policies set min_autonomy_level=1 where tool_key='create_recommendation';
