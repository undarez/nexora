-- Reconcile legacy GitHub migrations 0055 and 0056 with the live Supabase schema.
create table if not exists public.lia_autonomous_learning_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  query text not null,
  area text not null check (area in ('finance','regulation','security','privacy','methodology')),
  status text not null default 'running' check (status in ('running','learned','candidate_knowledge','blocked_contradiction','waiting_for_search_provider','failed')),
  provider text,
  sources_found integer not null default 0 check (sources_found >= 0),
  sources_acquired integer not null default 0 check (sources_acquired >= 0),
  knowledge_candidates integer not null default 0 check (knowledge_candidates >= 0),
  verified_knowledge integer not null default 0 check (verified_knowledge >= 0),
  contradictions integer not null default 0 check (contradictions >= 0),
  accepted_memories integer not null default 0 check (accepted_memories >= 0),
  source_refs jsonb not null default '[]'::jsonb,
  guardrails jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_lia_autonomous_learning_cycles_user_time on public.lia_autonomous_learning_cycles(user_id,created_at desc);
alter table public.lia_autonomous_learning_cycles enable row level security;
drop policy if exists lia_autonomous_learning_cycles_owner_read on public.lia_autonomous_learning_cycles;
create policy lia_autonomous_learning_cycles_owner_read on public.lia_autonomous_learning_cycles for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.lia_autonomous_learning_cycles from public, anon, authenticated;

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
