-- NEXORA LIA autonomy hardening: dynamic read-only web capability + lifecycle reconciliation.
insert into public.lia_tool_policies (tool_key, risk_level, min_autonomy_level, human_approval_required, reversible, enabled, policy)
values ('research_web', 'read', 0, false, true, true, jsonb_build_object('read_only', true, 'trusted_domains_only', true, 'activation_allowed', false, 'max_sources', 6, 'max_timeout_ms', 12000))
on conflict (tool_key) do update set risk_level=excluded.risk_level, min_autonomy_level=excluded.min_autonomy_level, human_approval_required=excluded.human_approval_required, reversible=excluded.reversible, enabled=excluded.enabled, policy=excluded.policy, updated_at=now();

-- Repair historical lifecycle/status contradictions without changing business facts.
update public.agent_loop_runs
set status = case context->'goal_lifecycle'->>'state'
  when 'completed' then 'completed'
  when 'failed' then 'failed'
  when 'blocked' then 'blocked'
  when 'needs_human' then 'needs_human'
  else status
end,
completed_at = case
  when context->'goal_lifecycle'->>'state' in ('completed','failed','blocked','needs_human') then coalesce(completed_at, (context->'goal_lifecycle'->>'completedAt')::timestamptz, now())
  else null
end
where context ? 'goal_lifecycle';

with stale as (
  select r.id
  from public.agent_loop_runs r
  where r.status='running'
    and coalesce(r.context->'goal_lifecycle'->>'state','objective') not in ('completed','failed','blocked','needs_human')
    and r.created_at < now() - interval '2 hours'
    and not exists (select 1 from public.agent_loop_steps s where s.loop_run_id=r.id and s.created_at > now() - interval '30 minutes')
)
update public.agent_loop_runs r
set status='blocked', completed_at=coalesce(r.completed_at, now()),
    decision=jsonb_set(coalesce(r.decision,'{}'::jsonb), '{runtime_reconciliation}', '{"reason":"stale_run_without_recent_activity","reconciled":true}'::jsonb, true)
where r.id in (select id from stale);
