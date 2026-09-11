-- Gérer Finance: security hardening + durable agent loop primitives.
-- This migration is intentionally additive. Password-compromise protection is
-- an Auth dashboard setting and cannot be enabled safely from SQL alone.

create table if not exists public.agent_loop_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trigger_type text not null check (trigger_type in ('user_request','scheduled','proactive','goal','retry')),
  status text not null default 'running' check (status in ('running','completed','failed','blocked','needs_human')),
  goal text not null,
  context jsonb not null default '{}'::jsonb,
  decision jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.agent_loop_steps (
  id uuid primary key default gen_random_uuid(),
  loop_run_id uuid not null references public.agent_loop_runs(id) on delete cascade,
  step_order integer not null,
  phase text not null check (phase in ('observe','context','plan','act','verify','decide','learn')),
  agent_key text,
  status text not null default 'completed',
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  duration_ms integer,
  created_at timestamptz not null default now(),
  unique(loop_run_id, step_order)
);

create table if not exists public.agent_evidence (
  id uuid primary key default gen_random_uuid(),
  loop_run_id uuid not null references public.agent_loop_runs(id) on delete cascade,
  step_id uuid references public.agent_loop_steps(id) on delete set null,
  evidence_type text not null,
  source text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.agent_loop_runs enable row level security;
alter table public.agent_loop_steps enable row level security;
alter table public.agent_evidence enable row level security;

drop policy if exists "agent loop runs own" on public.agent_loop_runs;
create policy "agent loop runs own" on public.agent_loop_runs for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "agent loop steps own" on public.agent_loop_steps;
create policy "agent loop steps own" on public.agent_loop_steps for all to authenticated using (exists (select 1 from public.agent_loop_runs r where r.id = loop_run_id and r.user_id = (select auth.uid()))) with check (exists (select 1 from public.agent_loop_runs r where r.id = loop_run_id and r.user_id = (select auth.uid())));

drop policy if exists "agent evidence own" on public.agent_evidence;
create policy "agent evidence own" on public.agent_evidence for all to authenticated using (exists (select 1 from public.agent_loop_runs r where r.id = loop_run_id and r.user_id = (select auth.uid()))) with check (exists (select 1 from public.agent_loop_runs r where r.id = loop_run_id and r.user_id = (select auth.uid())));

create index if not exists agent_loop_runs_user_created_idx on public.agent_loop_runs(user_id, created_at desc);
create index if not exists agent_loop_steps_run_order_idx on public.agent_loop_steps(loop_run_id, step_order);
create index if not exists agent_evidence_run_created_idx on public.agent_evidence(loop_run_id, created_at desc);

-- Fix mutable search_path on the budget timestamp trigger.
create or replace function public.touch_budget_planning_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Restrict SECURITY DEFINER helpers to the trigger execution path. The helper
-- itself remains callable by PostgreSQL's trigger mechanism.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Some deployments have this learning-memory trigger from a later migration.
-- Harden it when present without making this migration depend on that optional table.
do $$
declare
  fn regprocedure;
begin
  select p.oid::regprocedure
    into fn
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'touch_learning_memory_updated_at'
  limit 1;

  if fn is not null then
    execute format('alter function %s set search_path = public', fn);
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
  end if;
end $$;
