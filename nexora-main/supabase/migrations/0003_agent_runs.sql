-- Gérer Finance: audit trail for AI/Hermes runs and scheduled loop analyses.
create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent text not null,
  model text,
  task_type text not null,
  input_summary jsonb not null default '{}'::jsonb,
  output_summary jsonb not null default '{}'::jsonb,
  status text not null default 'completed',
  error_message text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists agent_runs_user_created_idx on public.agent_runs(user_id, created_at desc);
create index if not exists agent_runs_task_created_idx on public.agent_runs(user_id, task_type, created_at desc);

alter table public.agent_runs enable row level security;
drop policy if exists "agent runs own" on public.agent_runs;
create policy "agent runs own" on public.agent_runs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.loop_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  loop_type text not null check (loop_type in ('weekly','monthly')),
  period_start date not null,
  period_end date not null,
  status text not null default 'completed',
  analysis jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  learning_updates jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists loop_runs_user_type_created_idx on public.loop_runs(user_id, loop_type, created_at desc);

alter table public.loop_runs enable row level security;
drop policy if exists "loop runs own" on public.loop_runs;
create policy "loop runs own" on public.loop_runs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
