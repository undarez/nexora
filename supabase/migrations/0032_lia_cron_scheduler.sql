-- v4.62: real server-triggered cron lifecycle. Scheduling never grants tool permissions.
alter table public.lia_runtime_jobs
  add column if not exists timezone text not null default 'UTC',
  add column if not exists execution_mode text not null default 'agent' check (execution_mode in ('agent','no-agent')),
  add column if not exists failure_count integer not null default 0 check (failure_count >= 0 and failure_count <= 100),
  add column if not exists last_error text;

create index if not exists lia_runtime_jobs_due_idx on public.lia_runtime_jobs(runtime_type,status,next_run_at)
  where runtime_type = 'cron';

create or replace function public.lia_create_cron_job(
  p_user_id uuid,
  p_name text,
  p_schedule text,
  p_description text default '',
  p_payload jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_uid uuid := auth.uid();
begin
  if v_uid is null or v_uid <> p_user_id then raise exception 'cron_forbidden' using errcode='42501'; end if;
  if p_name is null or length(trim(p_name)) < 2 or length(p_name) > 120 then raise exception 'invalid_cron_name'; end if;
  if p_schedule is null or length(trim(p_schedule)) < 2 or length(p_schedule) > 120 then raise exception 'invalid_cron_schedule'; end if;
  if jsonb_typeof(coalesce(p_payload,'{}'::jsonb)) <> 'object' then raise exception 'invalid_cron_payload'; end if;
  insert into public.lia_runtime_jobs(user_id,runtime_type,name,description,schedule,status,payload,requires_policy_gate,requires_human_approval,execution_mode)
  values(p_user_id,'cron',left(trim(p_name),120),left(coalesce(p_description,''),500),left(trim(p_schedule),120),'ready',coalesce(p_payload,'{}'::jsonb),true,true,case when coalesce(p_payload->>'execution_mode','agent')='no-agent' then 'no-agent' else 'agent' end)
  returning id into v_id;
  insert into public.lia_runtime_events(user_id,runtime_job_id,runtime_type,event,status,payload)
  values(p_user_id,v_id,'cron','cron.scheduled','completed',jsonb_build_object('schedule',p_schedule));
  return v_id;
end; $$;
revoke all on function public.lia_create_cron_job(uuid,text,text,text,jsonb) from public,anon;
grant execute on function public.lia_create_cron_job(uuid,text,text,text,jsonb) to authenticated,service_role;

create or replace function public.lia_stop_loop(p_user_id uuid, p_loop_run_id uuid)
returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_exists boolean; v_uid uuid := auth.uid();
begin
  if v_uid is null or v_uid <> p_user_id then raise exception 'stop_forbidden' using errcode='42501'; end if;
  select exists(select 1 from public.agent_loop_runs where id=p_loop_run_id and user_id=p_user_id and status='running') into v_exists;
  if not v_exists then return false; end if;
  update public.agent_loop_runs set status='blocked', decision=coalesce(decision,'{}'::jsonb) || jsonb_build_object('stop_requested',true,'stop_requested_at',now()), completed_at=now() where id=p_loop_run_id and user_id=p_user_id and status='running';
  insert into public.lia_runtime_events(user_id,loop_run_id,runtime_type,event,status,payload)
  values(p_user_id,p_loop_run_id,'stop','stop.accepted','completed',jsonb_build_object('reason','user_requested_stop'));
  return true;
end; $$;
revoke all on function public.lia_stop_loop(uuid,uuid) from public,anon;
grant execute on function public.lia_stop_loop(uuid,uuid) to authenticated,service_role;
