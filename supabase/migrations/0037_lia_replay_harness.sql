-- v4.69: replay/evaluation harness. Evidence only; never validation or activation authority.
create table if not exists public.lia_replay_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  candidate_skill_id uuid references public.lia_skills(id) on delete set null,
  scenarios jsonb not null default '[]'::jsonb,
  baseline jsonb not null default '{}'::jsonb,
  candidate jsonb not null default '{}'::jsonb,
  comparison jsonb not null default '{}'::jsonb,
  eligible_for_human_review boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_lia_replay_runs_user_time on public.lia_replay_runs(user_id, created_at desc);
alter table public.lia_replay_runs enable row level security;
drop policy if exists lia_replay_runs_owner_read on public.lia_replay_runs;
create policy lia_replay_runs_owner_read on public.lia_replay_runs for select to authenticated using (user_id=auth.uid());
revoke insert, update, delete on public.lia_replay_runs from public, anon, authenticated;
comment on table public.lia_replay_runs is 'Replay/evaluation evidence for candidate improvements. It never grants validation or activation authority.';
