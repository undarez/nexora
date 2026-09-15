-- Chapters 2-7: tighten the database security boundary used by the autonomous LIA core.
-- SECURITY DEFINER RPCs are never callable anonymously. Authenticated access remains
-- governed by the existing function-level checks and RLS policies.

revoke execute on function public.financial_memory_last_validated_version(uuid) from anon;
revoke execute on function public.lia_apply_relational_feedback(uuid, text, jsonb) from anon;
revoke execute on function public.lia_get_relational_context(uuid) from anon;
revoke execute on function public.lia_record_decision(uuid, uuid, text, jsonb, jsonb, text, integer, boolean, text, text) from anon;
revoke execute on function public.lia_record_relational_signal(uuid, text, jsonb) from anon;
revoke execute on function public.lia_record_strategy_experience(uuid, text, text, text, integer, jsonb, jsonb) from anon;
revoke execute on function public.lia_select_procedure(uuid, text, text, text) from anon;
revoke execute on function public.lia_supervisor_fail_closed(text, boolean, boolean) from anon;
revoke execute on function public.record_agent_behaviour_event(uuid, uuid, text, text, jsonb) from anon;
revoke execute on function public.record_agent_decision_gate(uuid, uuid, text, text, boolean, boolean, text, numeric, text, uuid[], uuid[], jsonb) from anon;
revoke execute on function public.rollback_lia_memory_to_last_validated(uuid, text) from anon;
revoke execute on function public.version_lia_memory(uuid, jsonb, text, text, text) from anon;

-- Prevent caller-controlled search_path resolution in the two flagged triggers.
alter function public.touch_lia_autopilot_updated_at() set search_path = public, pg_temp;
alter function public.set_lia_memory_agents_updated_at() set search_path = public, pg_temp;

-- The interaction summary is intended to respect the caller's RLS context.
alter view public.lia_recent_interaction_summary set (security_invoker = true);

comment on migration is 'LIA chapters 2-7 security boundary hardening: anonymous RPC denial, fixed search_path, security-invoker interaction view';
