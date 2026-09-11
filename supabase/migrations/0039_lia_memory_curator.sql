-- v4.71: governed memory curation. Curator proposes consolidation/obsolescence; it never accepts, deletes, activates, or changes policy.
create table if not exists public.lia_memory_curation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inspected_count integer not null default 0 check (inspected_count >= 0),
  duplicate_groups jsonb not null default '[]'::jsonb,
  merge_candidates jsonb not null default '[]'::jsonb,
  contradictions jsonb not null default '[]'::jsonb,
  obsolete_candidates jsonb not null default '[]'::jsonb,
  activation_allowed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_lia_memory_curation_user_time on public.lia_memory_curation_runs(user_id, created_at desc);
alter table public.lia_memory_curation_runs enable row level security;
drop policy if exists lia_memory_curation_owner_read on public.lia_memory_curation_runs;
create policy lia_memory_curation_owner_read on public.lia_memory_curation_runs for select to authenticated using (user_id=auth.uid());
revoke insert, update, delete on public.lia_memory_curation_runs from public, anon, authenticated;
comment on table public.lia_memory_curation_runs is 'Curator evidence only. Consolidation, archival, acceptance and activation require separate governed operations.';
