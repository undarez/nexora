-- v5.04.5: deterministic goal completion/evaluation layer.
create table if not exists public.lia_goal_evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  orchestration_run_id uuid not null references public.lia_orchestration_runs(id) on delete cascade,
  status text not null check (status in ('continue','completed','needs_human','blocked','failed')),
  achieved boolean not null default false,
  progress integer not null default 0 check (progress between 0 and 100),
  checks jsonb not null default '[]'::jsonb,
  next_action text not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_lia_goal_evaluations_run_created on public.lia_goal_evaluations(orchestration_run_id, created_at desc);
alter table public.lia_goal_evaluations enable row level security;
drop policy if exists lia_goal_evaluations_owner on public.lia_goal_evaluations;
create policy lia_goal_evaluations_owner on public.lia_goal_evaluations for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
comment on table public.lia_goal_evaluations is 'Deterministic goal completion evidence; evaluation never grants permissions.';
