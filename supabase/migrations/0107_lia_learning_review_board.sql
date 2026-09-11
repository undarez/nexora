-- V5.08.53: governed human review board for LIA learning candidates.
create table if not exists public.lia_learning_review_board (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.lia_skills(id) on delete cascade,
  skill_version_id uuid null references public.lia_skill_versions(id) on delete set null,
  replay_run_id uuid null references public.lia_replay_runs(id) on delete set null,
  title text not null,
  category text not null default 'learning',
  verdict text not null check (verdict in ('improved','no_regression','regression','insufficient_evidence')),
  baseline_score integer not null check (baseline_score between 0 and 100),
  candidate_score integer not null check (candidate_score between 0 and 100),
  score_delta integer not null,
  regressions jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected','replay_requested')),
  review_note text,
  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  authority jsonb not null default '{"modelWeightUpdate":false,"policyUpdate":false,"financialFactUpdate":false,"permissionUpdate":false,"skillActivation":false}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_lia_learning_review_status_created
  on public.lia_learning_review_board(status, created_at desc);
create index if not exists idx_lia_learning_review_skill
  on public.lia_learning_review_board(skill_id, created_at desc);

alter table public.lia_learning_review_board enable row level security;
revoke all on public.lia_learning_review_board from anon, authenticated;

comment on table public.lia_learning_review_board is 'Admin-only human review queue. Decisions never activate skills or modify model weights, policy, permissions, or financial facts.';
