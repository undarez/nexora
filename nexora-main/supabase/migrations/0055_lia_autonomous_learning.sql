-- v5.03.2: bounded autonomous learning loop.
-- Research may create evidence/knowledge candidates and accepted semantic memory only
-- after deterministic corroboration. It never receives financial write authority.
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
comment on table public.lia_autonomous_learning_cycles is 'Bounded autonomous research/learning telemetry. Internet access is restricted to trusted domains; no financial writes and no model-weight self-modification.';
