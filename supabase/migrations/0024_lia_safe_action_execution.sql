-- v4.53: first autonomous low-risk action with explicit scope, idempotency and audit.
-- Only create_recommendation is eligible for autonomous execution at L3+.

alter table public.lia_action_proposals
  add column if not exists execution_key text;
create unique index if not exists ux_lia_action_proposals_execution_key
  on public.lia_action_proposals(user_id, execution_key)
  where execution_key is not null;

-- A recommendation is low-risk, reversible, and may be autonomous from L3.
update public.lia_tool_policies
set min_autonomy_level = 1,
    human_approval_required = false
where tool_key = 'create_recommendation';

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
        elsif p_tool_key='create_recommendation' and p_autonomy_level < 3 then reason:='human_approval_required';
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
