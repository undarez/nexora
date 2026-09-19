-- NEXORA Step 6 — autonomous skill evaluation telemetry.
create table if not exists public.lia_skill_evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  skill_id uuid not null references public.lia_skills(id) on delete cascade,
  skill_version_id uuid references public.lia_skill_versions(id) on delete set null,
  learning_cycle_id uuid references public.lia_autonomous_learning_cycles(id) on delete set null,
  evaluation_type text not null default 'runtime',
  use_count integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  success_rate numeric(6,3),
  score integer not null check (score between 0 and 100),
  verdict text not null check (verdict in ('healthy','watch','needs_review','insufficient_evidence')),
  regressions jsonb not null default '[]'::jsonb,
  gaps jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  activation_allowed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists lia_skill_evaluations_skill_time_idx on public.lia_skill_evaluations(skill_id, created_at desc);
create index if not exists lia_skill_evaluations_cycle_idx on public.lia_skill_evaluations(learning_cycle_id, created_at desc);
alter table public.lia_skill_evaluations enable row level security;
revoke all on public.lia_skill_evaluations from public, anon, authenticated;
grant select on public.lia_skill_evaluations to service_role;
comment on table public.lia_skill_evaluations is 'Step 6 read-only evaluator for procedural skill quality. It cannot activate, promote, modify permissions, policy or financial facts.';
