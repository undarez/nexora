-- v5.03.3: bounded metacognitive control for autonomous learning.
-- LIA can assess what it knows, identify gaps, select the next bounded research
-- objective, and record the outcome. It cannot modify permissions, policies,
-- model weights, or financial data through this mechanism.
create table if not exists public.lia_metacognitive_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  learning_cycle_id uuid references public.lia_autonomous_learning_cycles(id) on delete set null,
  objective text not null,
  known_context jsonb not null default '{}'::jsonb,
  knowledge_gaps jsonb not null default '[]'::jsonb,
  selected_action jsonb not null default '{}'::jsonb,
  evaluation jsonb not null default '{}'::jsonb,
  next_objective text,
  status text not null default 'planned' check (status in ('planned','researched','evaluated','blocked','failed')),
  guardrails jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_lia_metacognitive_cycles_user_time on public.lia_metacognitive_cycles(user_id,created_at desc);
alter table public.lia_metacognitive_cycles enable row level security;
drop policy if exists lia_metacognitive_cycles_owner_read on public.lia_metacognitive_cycles;
create policy lia_metacognitive_cycles_owner_read on public.lia_metacognitive_cycles for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.lia_metacognitive_cycles from public, anon, authenticated;
comment on table public.lia_metacognitive_cycles is 'Bounded metacognitive planning/evaluation telemetry. It cannot change permissions, policies, model weights, or financial records.';
