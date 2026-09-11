-- v4.72: provenance-aware semantic knowledge graph proposal layer.
create table if not exists public.lia_knowledge_graph_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  contradictions jsonb not null default '[]'::jsonb,
  stale_candidates jsonb not null default '[]'::jsonb,
  provenance_required boolean not null default true,
  activation_allowed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_lia_knowledge_graph_runs_user_time on public.lia_knowledge_graph_runs(user_id, created_at desc);
alter table public.lia_knowledge_graph_runs enable row level security;
drop policy if exists lia_knowledge_graph_runs_owner_read on public.lia_knowledge_graph_runs;
create policy lia_knowledge_graph_runs_owner_read on public.lia_knowledge_graph_runs for select to authenticated using (user_id=auth.uid());
revoke insert, update, delete on public.lia_knowledge_graph_runs from public, anon, authenticated;
comment on table public.lia_knowledge_graph_runs is 'Provenance-aware knowledge graph proposals. This table never grants activation authority.';
