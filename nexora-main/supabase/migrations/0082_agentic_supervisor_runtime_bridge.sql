-- NEXORA v5.06.18: bridge the existing supervisor foundation to the runtime.
-- The canonical Policy Engine / Decision Gate remain authoritative.
create or replace function public.lia_supervisor_record_run(
  p_user_id uuid,
  p_trigger_type text,
  p_objective text,
  p_context jsonb default '{}'::jsonb,
  p_plan jsonb default '{}'::jsonb,
  p_max_steps integer default 5
) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if p_trigger_type not in ('user_request','scheduled','proactive','goal','autopilot') then raise exception 'invalid supervisor trigger'; end if;
  insert into public.lia_supervisor_runs(
    user_id, objective, status, requested_autonomy_level, effective_autonomy_level,
    risk_class, reversible, gate_outcome, dry_run, max_steps, max_replans,
    max_retries_per_step, context
  ) values (
    p_user_id, left(trim(p_objective),500), 'running', 1, 1, 'low', true,
    'ALLOW_WITH_GUARDRAIL', true, greatest(1,least(coalesce(p_max_steps,5),50)), 5, 3,
    coalesce(p_context,'{}'::jsonb) || jsonb_build_object('trigger_type',p_trigger_type,'plan',coalesce(p_plan,'{}'::jsonb),'supervisor_runtime_version','1.0.0')
  ) returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.lia_supervisor_record_run(uuid,text,text,jsonb,jsonb,integer) from public,anon;
grant execute on function public.lia_supervisor_record_run(uuid,text,text,jsonb,jsonb,integer) to authenticated,service_role;
create index if not exists idx_lia_supervisor_runs_user_created on public.lia_supervisor_runs(user_id,created_at desc);
