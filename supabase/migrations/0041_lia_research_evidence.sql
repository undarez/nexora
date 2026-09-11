-- v4.73: provenance-aware research/evidence adjudication. Server evidence only; never grants activation.
create table if not exists public.lia_research_runs (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 query text not null, evidence jsonb not null default '[]'::jsonb, claims jsonb not null default '[]'::jsonb,
 contradictions jsonb not null default '[]'::jsonb, stale_evidence jsonb not null default '[]'::jsonb,
 unknowns jsonb not null default '[]'::jsonb, minimum_evidence_met boolean not null default false,
 knowledge_graph_ready boolean not null default false, activation_allowed boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists idx_lia_research_runs_user_time on public.lia_research_runs(user_id,created_at desc);
alter table public.lia_research_runs enable row level security;
drop policy if exists lia_research_runs_owner_read on public.lia_research_runs;
create policy lia_research_runs_owner_read on public.lia_research_runs for select to authenticated using(user_id=auth.uid());
revoke insert,update,delete on public.lia_research_runs from public,anon,authenticated;
comment on table public.lia_research_runs is 'Research evidence adjudication. Stores provenance and verification results; never grants activation authority.';
