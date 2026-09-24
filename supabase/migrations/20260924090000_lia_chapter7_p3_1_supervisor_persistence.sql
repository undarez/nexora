-- Chapter 7 P3.1 — persistent governed supervisor lifecycle.
-- All writes are service-role-only and never grant execution authority.
create or replace function public.lia_orchestration_start_run(
  p_user_id uuid,
  p_objective text,
  p_max_steps integer default 5,
  p_max_replans integer default 2,
  p_max_tool_calls integer default 8,
  p_max_retries integer default 4,
  p_max_research_requests integer default 3,
  p_max_memory_writes integer default 5,
  p_context jsonb default '{}'::jsonb,
  p_strategy_key text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run_id uuid;
  v_max_steps integer := greatest(1, least(coalesce(p_max_steps, 5), 5));
  v_max_replans integer := greatest(0, least(coalesce(p_max_replans, 2), 10));
begin
  if p_user_id is null then raise exception 'invalid_user_id'; end if;
  if p_objective is null or length(trim(p_objective)) < 2 then raise exception 'invalid_objective'; end if;

  insert into public.lia_orchestration_runs(
    user_id, objective, status, max_steps, current_step, context, result,
    strategy_key, plan_version, replan_count
  )
  values(
    p_user_id, left(trim(p_objective), 4000), 'running', v_max_steps, 0,
    coalesce(p_context, '{}'::jsonb), '{}'::jsonb, nullif(left(trim(coalesce(p_strategy_key, '')), 120), ''),
    1, 0
  )
  returning id into v_run_id;

  insert into public.lia_orchestration_budgets(
    run_id, user_id, max_steps, max_tool_calls, max_retries, max_replans,
    max_research_requests, max_memory_writes
  )
  values(
    v_run_id, p_user_id, v_max_steps,
    greatest(0, least(coalesce(p_max_tool_calls, 8), 100)),
    greatest(0, least(coalesce(p_max_retries, 4), 50)),
    v_max_replans,
    greatest(0, least(coalesce(p_max_research_requests, 3), 50)),
    greatest(0, least(coalesce(p_max_memory_writes, 5), 50))
  );

  return v_run_id;
end;
$$;

revoke all on function public.lia_orchestration_start_run(uuid,text,integer,integer,integer,integer,integer,integer,jsonb,text) from public, anon, authenticated;
grant execute on function public.lia_orchestration_start_run(uuid,text,integer,integer,integer,integer,integer,integer,jsonb,text) to service_role;

create or replace function public.lia_orchestration_upsert_step(
  p_run_id uuid,
  p_user_id uuid,
  p_step_index integer,
  p_objective text,
  p_status text default 'planned',
  p_risk_class text default 'read',
  p_human_gate_required boolean default false,
  p_verification_rules jsonb default '[]'::jsonb,
  p_input_context jsonb default '{}'::jsonb,
  p_output_context jsonb default '{}'::jsonb,
  p_parent_step_id uuid default null,
  p_depends_on integer[] default '{}',
  p_agent_key text default null,
  p_execution_policy jsonb default '{}'::jsonb,
  p_handoff_context jsonb default '{}'::jsonb,
  p_evidence_refs jsonb default '[]'::jsonb,
  p_retry_count integer default 0,
  p_last_error text default null,
  p_recovery_strategy text default null,
  p_recovery_reason text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_run_user uuid;
begin
  select user_id into v_run_user
  from public.lia_orchestration_runs
  where id = p_run_id;

  if v_run_user is null or v_run_user <> p_user_id then raise exception 'orchestration_run_not_found'; end if;
  if p_step_index < 1 or p_step_index > 5 then raise exception 'invalid_step_index'; end if;
  if p_objective is null or length(trim(p_objective)) < 1 then raise exception 'invalid_step_objective'; end if;

  insert into public.lia_orchestration_steps(
    run_id, step_index, objective, status, risk_class, human_gate_required,
    verification_rules, input_context, output_context, parent_step_id, depends_on,
    agent_key, execution_policy, handoff_context, evidence_refs, retry_count,
    last_error, recovery_strategy, recovery_reason,
    completed_at, verified_at
  )
  values(
    p_run_id, p_step_index, left(trim(p_objective), 4000),
    case when p_status in ('planned','running','waiting','completed','failed','blocked','skipped')
      then p_status else 'planned' end,
    case when p_risk_class in ('read','write','critical') then p_risk_class else 'read' end,
    coalesce(p_human_gate_required, false), coalesce(p_verification_rules, '[]'::jsonb),
    coalesce(p_input_context, '{}'::jsonb), coalesce(p_output_context, '{}'::jsonb),
    p_parent_step_id, coalesce(p_depends_on, '{}'::integer[]), nullif(left(trim(coalesce(p_agent_key, '')), 120), ''),
    coalesce(p_execution_policy, '{}'::jsonb), coalesce(p_handoff_context, '{}'::jsonb),
    coalesce(p_evidence_refs, '[]'::jsonb), greatest(0, least(coalesce(p_retry_count, 0), 50)),
    left(p_last_error, 1000), nullif(left(trim(coalesce(p_recovery_strategy, '')), 120), ''),
    left(p_recovery_reason, 1000),
    case when p_status in ('completed','failed','blocked','skipped') then now() else null end,
    case when p_status = 'completed' then now() else null end
  )
  on conflict (run_id, step_index) do update set
    objective = excluded.objective,
    status = excluded.status,
    risk_class = excluded.risk_class,
    human_gate_required = excluded.human_gate_required,
    verification_rules = excluded.verification_rules,
    input_context = excluded.input_context,
    output_context = excluded.output_context,
    parent_step_id = excluded.parent_step_id,
    depends_on = excluded.depends_on,
    agent_key = excluded.agent_key,
    execution_policy = excluded.execution_policy,
    handoff_context = excluded.handoff_context,
    evidence_refs = excluded.evidence_refs,
    retry_count = excluded.retry_count,
    last_error = excluded.last_error,
    recovery_strategy = excluded.recovery_strategy,
    recovery_reason = excluded.recovery_reason,
    completed_at = excluded.completed_at,
    verified_at = excluded.verified_at
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.lia_orchestration_upsert_step(uuid,uuid,integer,text,text,text,boolean,jsonb,jsonb,jsonb,uuid,integer[],text,jsonb,jsonb,jsonb,integer,text,text,text) from public, anon, authenticated;
grant execute on function public.lia_orchestration_upsert_step(uuid,uuid,integer,text,text,text,boolean,jsonb,jsonb,jsonb,uuid,integer[],text,jsonb,jsonb,jsonb,integer,text,text,text) to service_role;

create or replace function public.lia_orchestration_update_run(
  p_run_id uuid,
  p_user_id uuid,
  p_status text,
  p_current_step integer default null,
  p_context jsonb default null,
  p_result jsonb default null,
  p_replan_reason text default null
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.lia_orchestration_runs
  set
    status = case when p_status in ('planned','running','waiting','completed','partial','failed','blocked','cancelled')
      then p_status else 'failed' end,
    current_step = case when p_current_step is null then current_step else greatest(0, least(p_current_step, 5)) end,
    context = coalesce(p_context, context),
    result = coalesce(p_result, result),
    replan_reason = case when p_replan_reason is null then replan_reason else left(p_replan_reason, 1000) end,
    replanned_at = case when p_replan_reason is null then replanned_at else now() end,
    completed_at = case when p_status in ('completed','partial','failed','blocked','cancelled') then now() else null end,
    updated_at = now()
  where id = p_run_id and user_id = p_user_id;

  return found;
end;
$$;

revoke all on function public.lia_orchestration_update_run(uuid,uuid,text,integer,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.lia_orchestration_update_run(uuid,uuid,text,integer,jsonb,jsonb,text) to service_role;

create or replace function public.lia_orchestration_request_replan(
  p_run_id uuid,
  p_user_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_budget jsonb;
  v_run public.lia_orchestration_runs;
begin
  select * into v_run
  from public.lia_orchestration_runs
  where id = p_run_id and user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'orchestration_run_not_found');
  end if;

  v_budget := public.lia_consume_orchestration_budget(p_run_id, p_user_id, 'replans', 1);
  if coalesce((v_budget->>'allowed')::boolean, false) is not true then
    return v_budget || jsonb_build_object('plan_version', v_run.plan_version, 'replan_count', v_run.replan_count);
  end if;

  update public.lia_orchestration_runs
  set plan_version = plan_version + 1,
      replan_count = replan_count + 1,
      replan_reason = left(coalesce(p_reason, 'governed_replan'), 1000),
      replanned_at = now(),
      updated_at = now()
  where id = p_run_id and user_id = p_user_id;

  return v_budget || jsonb_build_object(
    'plan_version', v_run.plan_version + 1,
    'replan_count', v_run.replan_count + 1
  );
end;
$$;

revoke all on function public.lia_orchestration_request_replan(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.lia_orchestration_request_replan(uuid,uuid,text) to service_role;

create or replace function public.lia_orchestration_write_work_memory(
  p_run_id uuid,
  p_user_id uuid,
  p_memory jsonb
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_budget jsonb;
  v_budget_run uuid;
begin
  select b.run_id into v_budget_run
  from public.lia_orchestration_budgets b
  where b.run_id = p_run_id and b.user_id = p_user_id;

  if v_budget_run is null then return false; end if;

  v_budget := public.lia_consume_orchestration_budget(v_budget_run, p_user_id, 'memory_writes', 1);
  if coalesce((v_budget->>'allowed')::boolean, false) is not true then
    return false;
  end if;

  insert into public.lia_specialist_work_memory(user_id, agent_id, memory, updated_at)
  values(p_user_id, 'supervisor', coalesce(p_memory, '{}'::jsonb), now())
  on conflict (user_id, agent_id) do update
    set memory = excluded.memory, updated_at = now();

  return true;
end;
$$;

revoke all on function public.lia_orchestration_write_work_memory(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.lia_orchestration_write_work_memory(uuid,uuid,jsonb) to service_role;
