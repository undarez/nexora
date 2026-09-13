-- v5.02.3: Admin governance for autonomous LIA cron jobs.
-- Users do not manage cron jobs; administrators retain full visibility and emergency control.

alter table public.lia_runtime_jobs
  add column if not exists admin_disabled boolean not null default false,
  add column if not exists admin_disabled_at timestamptz,
  add column if not exists admin_disabled_by uuid references auth.users(id) on delete set null,
  add column if not exists admin_disabled_reason text;

create table if not exists public.lia_runtime_controls (
  id integer primary key check (id = 1),
  cron_autonomy_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.lia_runtime_controls(id) values (1) on conflict (id) do nothing;

alter table public.lia_runtime_controls enable row level security;
revoke all on public.lia_runtime_controls from public, anon, authenticated;

create index if not exists lia_runtime_jobs_admin_control_idx
  on public.lia_runtime_jobs(runtime_type,status,admin_disabled,updated_at desc)
  where runtime_type = 'cron';

create or replace function public.lia_admin_set_cron_enabled(
  p_enabled boolean,
  p_admin_user_id uuid
) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.lia_runtime_controls
  set cron_autonomy_enabled=p_enabled, updated_at=now(), updated_by=p_admin_user_id
  where id=1;
  return found;
end; $$;
revoke all on function public.lia_admin_set_cron_enabled(boolean,uuid) from public,anon,authenticated;
grant execute on function public.lia_admin_set_cron_enabled(boolean,uuid) to service_role;
