-- v4.68: regression + cognitive improvement gate. Results are evidence, never activation authority.
create table if not exists public.lia_improvement_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  candidate_skill_id uuid references public.lia_skills(id) on delete set null,
  baseline jsonb not null default '{}'::jsonb,
  candidate jsonb not null default '{}'::jsonb,
  comparison jsonb not null default '{}'::jsonb,
  eligible_for_human_review boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_lia_improvement_runs_user_time on public.lia_improvement_runs(user_id, created_at desc);
alter table public.lia_improvement_runs enable row level security;
drop policy if exists lia_improvement_runs_owner_read on public.lia_improvement_runs;
create policy lia_improvement_runs_owner_read on public.lia_improvement_runs for select to authenticated using (user_id=auth.uid());
revoke insert, update, delete on public.lia_improvement_runs from public, anon, authenticated;
comment on table public.lia_improvement_runs is 'Regression evidence for candidate cognitive/procedural improvements. Never grants validation or activation authority.';
