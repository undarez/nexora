-- NEXORA Step 5 — durable runtime recovery.
-- Recovery only repairs stale orchestration state. It never grants financial execution authority.

create or replace function public.lia_recover_stale_runtime_jobs(
  p_stale_minutes integer default 30,
  p_limit integer default 50
)
returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_count integer;
begin
  update public.lia_runtime_jobs
  set status='ready',
      next_run_at=now(),
      last_status='recovered_stale_running',
      last_error='Recovered by durable runtime recovery after worker timeout/crash.',
      failure_count=least(100,coalesce(failure_count,0)+1),
      updated_at=now()
  where id in (
    select id from public.lia_runtime_jobs
    where runtime_type='cron'
      and status='running'
      and last_run_at is not null
      and last_run_at < now() - make_interval(mins => greatest(1,least(coalesce(p_stale_minutes,30),1440)))
    order by last_run_at asc
    limit greatest(1,least(coalesce(p_limit,50),200))
    for update skip locked
  );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.lia_recover_stale_runtime_jobs(integer,integer) from public,anon,authenticated;
grant execute on function public.lia_recover_stale_runtime_jobs(integer,integer) to service_role;

create or replace function public.lia_recover_agentic_state(
  p_stale_minutes integer default 30,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_continuations integer := 0;
  v_missions integer := 0;
  v_loops integer := 0;
begin
  update public.lia_agent_continuations
  set status='active',
      next_check_at=now(),
      last_error='Recovered by durable runtime recovery.',
      updated_at=now()
  where id in (
    select id from public.lia_agent_continuations
    where status='waiting'
      and updated_at < now() - make_interval(mins => greatest(1,least(coalesce(p_stale_minutes,30),1440)))
      and attempts < 100
    order by updated_at asc
    limit greatest(1,least(coalesce(p_limit,50),200))
    for update skip locked
  );
  get diagnostics v_continuations = row_count;

  update public.lia_agent_missions
  set status='waiting',
      next_run_at=now(),
      last_error='Recovered by durable runtime recovery.',
      updated_at=now()
  where id in (
    select id from public.lia_agent_missions
    where status='running'
      and updated_at < now() - make_interval(mins => greatest(1,least(coalesce(p_stale_minutes,30),1440)))
      and attempts < 100
    order by updated_at asc
    limit greatest(1,least(coalesce(p_limit,50),200))
    for update skip locked
  );
  get diagnostics v_missions = row_count;

  update public.agent_loop_runs
  set status='blocked',
      completed_at=now(),
      context=jsonb_set(coalesce(context,'{}'::jsonb),'{runtime_recovery}',jsonb_build_object(
        'recovered_at',now(),
        'reason','stale_runtime_state',
        'stale_minutes',greatest(1,least(coalesce(p_stale_minutes,30),1440))
      ),true),
      decision=jsonb_set(coalesce(decision,'{}'::jsonb),'{runtime_recovery}',jsonb_build_object(
        'status','blocked',
        'reason','stale_runtime_state'
      ),true)
  where id in (
    select id from public.agent_loop_runs
    where status='running'
      and created_at < now() - make_interval(mins => greatest(5,least(coalesce(p_stale_minutes,30),1440)))
    order by created_at asc
    limit greatest(1,least(coalesce(p_limit,50),200))
    for update skip locked
  );
  get diagnostics v_loops = row_count;

  return jsonb_build_object(
    'continuations_recovered',v_continuations,
    'missions_recovered',v_missions,
    'stale_loops_blocked',v_loops,
    'recovered_at',now()
  );
end;
$$;

revoke all on function public.lia_recover_agentic_state(integer,integer) from public,anon,authenticated;
grant execute on function public.lia_recover_agentic_state(integer,integer) to service_role;
