-- v4.50: authoritative agent Policy Engine in Supabase.
-- The LLM and browser never authorize their own tool calls.

create table if not exists public.lia_agent_policy_decisions (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id text not null,
  tool_key text not null,
  autonomy_level integer not null check (autonomy_level between 0 and 8),
  allowed boolean not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_lia_policy_decisions_user_time
  on public.lia_agent_policy_decisions(user_id, created_at desc);

alter table public.lia_agent_policy_decisions enable row level security;
revoke all on public.lia_agent_policy_decisions from public, anon, authenticated;

create or replace function public.authorize_lia_tool(
  p_agent_id text,
  p_user_id uuid,
  p_organization_id text,
  p_tool_key text,
  p_autonomy_level integer
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  identity public.lia_agent_identities%rowtype;
  policy_row public.lia_tool_policies%rowtype;
  allowed boolean := false;
  reason text := 'policy_denied';
begin
  if p_autonomy_level is null or p_autonomy_level < 0 or p_autonomy_level > 8 then
    reason := 'invalid_autonomy_level';
  else
    select * into identity
    from public.lia_agent_identities
    where agent_id = p_agent_id
      and user_id = p_user_id
      and organization_id = p_organization_id
      and agent_key = 'lia'
      and role = 'financial_assistant'
      and enabled = true;

    if not found then
      reason := 'agent_identity_denied';
    else
      select * into policy_row
      from public.lia_tool_policies
      where tool_key = p_tool_key
        and enabled = true;

      if not found then
        reason := 'tool_policy_missing';
      elsif p_autonomy_level < policy_row.min_autonomy_level then
        reason := 'autonomy_level_insufficient';
      elsif policy_row.human_approval_required then
        reason := 'human_approval_required';
      else
        allowed := true;
        reason := 'allowed';
      end if;
    end if;
  end if;

  insert into public.lia_agent_policy_decisions(
    agent_id,user_id,organization_id,tool_key,autonomy_level,allowed,reason
  ) values (
    p_agent_id,p_user_id,p_organization_id,p_tool_key,p_autonomy_level,allowed,reason
  );

  return jsonb_build_object(
    'allowed', allowed,
    'reason', reason,
    'agent_id', p_agent_id,
    'tool_key', p_tool_key
  );
end;
$$;

revoke all on function public.authorize_lia_tool(text, uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.authorize_lia_tool(text, uuid, text, text, integer) to service_role;

comment on function public.authorize_lia_tool(text, uuid, text, text, integer) is
  'Authoritative server-side authorization gate for LIA tools. Service role only; every decision is audited.';
comment on table public.lia_agent_policy_decisions is
  'Immutable-by-client audit trail for agent tool authorization decisions.';
