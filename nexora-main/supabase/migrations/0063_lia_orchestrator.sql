-- v5.04.1: bounded multi-step LIA orchestrator.
create table if not exists public.lia_orchestration_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  objective text not null,
  status text not null default 'planned' check (status in ('planned','running','awaiting_human','completed','blocked','failed','cancelled')),
  max_steps integer not null default 5 check (max_steps between 1 and 5),
  current_step integer not null default 0,
  context jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists idx_lia_orchestration_runs_user_created
  on public.lia_orchestration_runs(user_id, created_at desc);

create table if not exists public.lia_orchestration_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.lia_orchestration_runs(id) on delete cascade,
  step_index integer not null check (step_index between 1 and 5),
  procedure_id uuid references public.lia_procedures(id) on delete set null,
  procedure_slug text,
  objective text not null,
  status text not null default 'planned' check (status in ('planned','running','awaiting_human','completed','blocked','failed','skipped')),
  risk_class text not null default 'read' check (risk_class in ('read','recommendation','write-sensitive','critical')),
  human_gate_required boolean not null default false,
  verification_rules jsonb not null default '[]'::jsonb,
  input_context jsonb not null default '{}'::jsonb,
  output_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(run_id, step_index)
);
create index if not exists idx_lia_orchestration_steps_run on public.lia_orchestration_steps(run_id, step_index);

alter table public.lia_orchestration_runs enable row level security;
alter table public.lia_orchestration_steps enable row level security;
drop policy if exists lia_orchestration_runs_owner on public.lia_orchestration_runs;
create policy lia_orchestration_runs_owner on public.lia_orchestration_runs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists lia_orchestration_steps_owner on public.lia_orchestration_steps;
create policy lia_orchestration_steps_owner on public.lia_orchestration_steps for all to authenticated
using (exists (select 1 from public.lia_orchestration_runs r where r.id=run_id and r.user_id=auth.uid()))
with check (exists (select 1 from public.lia_orchestration_runs r where r.id=run_id and r.user_id=auth.uid()));

comment on table public.lia_orchestration_runs is 'Bounded LIA multi-step plans. Planning does not imply execution.';
comment on table public.lia_orchestration_steps is 'Auditable steps selected from governed LIA procedures. Each step remains bounded by policy and autonomy.';
