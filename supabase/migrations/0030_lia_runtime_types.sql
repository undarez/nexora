-- v4.60: governed runtime types inspired by Hermes: agent, stop, curator, cron.
-- These are control-plane primitives, not permissions. Financial actions remain behind the Policy Engine.

alter table public.agent_loop_runs
  drop constraint if exists agent_loop_runs_trigger_type_check;
alter table public.agent_loop_runs
  add constraint agent_loop_runs_trigger_type_check
  check (trigger_type in ('user_request','scheduled','proactive','goal','retry','cron','curator','stop'));

create table if not exists public.lia_runtime_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  runtime_type text not null check (runtime_type in ('agent','stop','curator','cron')),
  name text not null,
  description text not null default '',
  schedule text,
  status text not null default 'ready' check (status in ('ready','running','paused','stopped','blocked','completed','failed')),
  payload jsonb not null default '{}'::jsonb,
  next_run_at timestamptz,
  last_run_at timestamptz,
  last_status text,
  requires_policy_gate boolean not null default true,
  requires_human_approval boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lia_runtime_jobs_user_type_idx on public.lia_runtime_jobs(user_id,runtime_type,status,updated_at desc);

create table if not exists public.lia_runtime_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  runtime_job_id uuid references public.lia_runtime_jobs(id) on delete set null,
  loop_run_id uuid references public.agent_loop_runs(id) on delete set null,
  runtime_type text not null check (runtime_type in ('agent','stop','curator','cron')),
  event text not null,
  status text not null default 'completed',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists lia_runtime_events_user_time_idx on public.lia_runtime_events(user_id,created_at desc);

alter table public.lia_runtime_jobs enable row level security;
alter table public.lia_runtime_events enable row level security;
create policy "users read own runtime jobs" on public.lia_runtime_jobs for select to authenticated using (user_id=auth.uid());
create policy "users read own runtime events" on public.lia_runtime_events for select to authenticated using (user_id=auth.uid());
revoke insert,update,delete on public.lia_runtime_jobs from anon,authenticated;
revoke insert,update,delete on public.lia_runtime_events from anon,authenticated;
revoke all on public.lia_runtime_jobs from public;
revoke all on public.lia_runtime_events from public;

-- Server/service-role only. The LLM cannot manufacture lifecycle events.
create or replace function public.lia_record_runtime_event(
  p_user_id uuid,
  p_runtime_type text,
  p_event text,
  p_status text default 'completed',
  p_runtime_job_id uuid default null,
  p_loop_run_id uuid default null,
  p_payload jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if p_runtime_type not in ('agent','stop','curator','cron') then raise exception 'invalid_runtime_type'; end if;
  if length(coalesce(p_event,'')) < 3 or length(p_event) > 80 then raise exception 'invalid_runtime_event'; end if;
  insert into public.lia_runtime_events(user_id,runtime_job_id,loop_run_id,runtime_type,event,status,payload)
  values(p_user_id,p_runtime_job_id,p_loop_run_id,p_runtime_type,p_event,left(p_status,40),coalesce(p_payload,'{}'::jsonb))
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.lia_record_runtime_event(uuid,text,text,text,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.lia_record_runtime_event(uuid,text,text,text,uuid,uuid,jsonb) to service_role;

-- Controlled runtime mutations exposed to the authenticated owner.
-- They only create/stop control-plane records; they never execute tools.
create or replace function public.lia_create_cron_job(
  p_user_id uuid,
  p_name text,
  p_schedule text,
  p_description text default '',
  p_payload jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if p_name is null or length(trim(p_name)) < 2 or length(p_name) > 120 then raise exception 'invalid_cron_name'; end if;
  if p_schedule is null or length(trim(p_schedule)) < 2 or length(p_schedule) > 120 then raise exception 'invalid_cron_schedule'; end if;
  if jsonb_typeof(coalesce(p_payload,'{}'::jsonb)) <> 'object' then raise exception 'invalid_cron_payload'; end if;
  insert into public.lia_runtime_jobs(user_id,runtime_type,name,description,schedule,status,payload,requires_policy_gate,requires_human_approval)
  values(p_user_id,'cron',left(trim(p_name),120),left(coalesce(p_description,''),500),left(trim(p_schedule),120),'ready',coalesce(p_payload,'{}'::jsonb),true,true)
  returning id into v_id;
  insert into public.lia_runtime_events(user_id,runtime_job_id,runtime_type,event,status,payload)
  values(p_user_id,v_id,'cron','cron.scheduled','completed',jsonb_build_object('schedule',p_schedule));
  return v_id;
end; $$;
revoke all on function public.lia_create_cron_job(uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.lia_create_cron_job(uuid,text,text,text,jsonb) to service_role;

create or replace function public.lia_stop_loop(p_user_id uuid, p_loop_run_id uuid)
returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_exists boolean;
begin
  select exists(select 1 from public.agent_loop_runs where id=p_loop_run_id and user_id=p_user_id and status='running') into v_exists;
  if not v_exists then return false; end if;
  update public.agent_loop_runs set status='blocked', decision=decision || jsonb_build_object('stop_requested',true,'stop_requested_at',now()), completed_at=now() where id=p_loop_run_id and user_id=p_user_id and status='running';
  insert into public.lia_runtime_events(user_id,loop_run_id,runtime_type,event,status,payload)
  values(p_user_id,p_loop_run_id,'stop','stop.accepted','completed',jsonb_build_object('reason','user_requested_stop'));
  return true;
end; $$;
revoke all on function public.lia_stop_loop(uuid,uuid) from public,anon,authenticated;
grant execute on function public.lia_stop_loop(uuid,uuid) to service_role;
