-- V5.08.57: privacy-minimized production telemetry for active LIA Skills.
-- Metrics only: no prompt, response, financial facts, provider identifiers or raw recommendation body.
create table if not exists public.lia_production_telemetry (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.lia_skills(id) on delete cascade,
  skill_version_id uuid null references public.lia_skill_versions(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  loop_run_id uuid null,
  quality_score integer not null check (quality_score between 0 and 100),
  verdict text not null check (verdict in ('accepted','corrected','blocked')),
  corrected boolean not null default false,
  recommendation_generated boolean not null default false,
  human_approval_required boolean not null default true,
  evidence_count integer not null default 0 check (evidence_count between 0 and 100),
  created_at timestamptz not null default now()
);

create index if not exists idx_lia_production_telemetry_skill_time
  on public.lia_production_telemetry(skill_id, skill_version_id, created_at desc);
create index if not exists idx_lia_production_telemetry_time
  on public.lia_production_telemetry(created_at desc);

alter table public.lia_production_telemetry enable row level security;
revoke all on public.lia_production_telemetry from public,anon,authenticated;
comment on table public.lia_production_telemetry is 'Privacy-minimized post-activation quality metrics. Never used to auto-promote, activate, rollback or mutate financial/policy state.';
