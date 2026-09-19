-- NEXORA Chapter 6 — Skill Laboratory.
-- Stores bounded challenger/replay evidence only. Candidate activation remains governed.

create table if not exists public.lia_skill_lab_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  baseline_skill_id uuid not null references public.lia_skills(id) on delete cascade,
  candidate_skill_id uuid references public.lia_skills(id) on delete set null,
  baseline_version_id uuid references public.lia_skill_versions(id) on delete set null,
  candidate_version_id uuid references public.lia_skill_versions(id) on delete set null,
  status text not null check (status in ('running','completed','blocked','failed')),
  challenge_count integer not null default 0,
  challenge_failures integer not null default 0,
  replay_score integer,
  verdict text,
  regressions jsonb not null default '[]'::jsonb,
  improvements jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  activation_allowed boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists lia_skill_lab_runs_user_time_idx on public.lia_skill_lab_runs(user_id, created_at desc);
create index if not exists lia_skill_lab_runs_skill_time_idx on public.lia_skill_lab_runs(baseline_skill_id, created_at desc);
alter table public.lia_skill_lab_runs enable row level security;
revoke all on public.lia_skill_lab_runs from public, anon, authenticated;
grant select on public.lia_skill_lab_runs to service_role;
comment on table public.lia_skill_lab_runs is 'Chapter 6 Skill Laboratory telemetry. Challenge/replay evidence only; no automatic activation or authority changes.';
