-- V5.08.59-63: auditable learning evidence pack. No raw prompts/responses are persisted.
create table if not exists public.lia_learning_evidence_packs (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.lia_skills(id) on delete cascade,
  skill_version_id uuid not null references public.lia_skill_versions(id) on delete cascade,
  evidence_fingerprint text not null,
  decision text not null check (decision in ('evidence_sufficient_for_review','evidence_incomplete')),
  gates jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now()
);
create index if not exists idx_lia_learning_evidence_skill_version on public.lia_learning_evidence_packs(skill_id, skill_version_id, generated_at desc);
alter table public.lia_learning_evidence_packs enable row level security;
revoke all on public.lia_learning_evidence_packs from public, anon, authenticated;
comment on table public.lia_learning_evidence_packs is 'Admin control-plane evidence summary for LIA learning. Never stores raw model content and never authorizes deployment.';
