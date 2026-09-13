-- ADDITIVE REFERENCE MIGRATION. Reconcile with live Nexora schema first.
create extension if not exists pgcrypto;

create table if not exists public.financial_memory_versions (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null,
  version integer not null,
  content_hash text not null,
  content_snapshot jsonb not null,
  status text not null check (status in ('proposed','validated','deprecated','conflicted','quarantined')),
  source_reason text,
  changed_by text,
  created_at timestamptz not null default now(),
  unique(memory_id, version),
  unique(memory_id, content_hash)
);

create table if not exists public.financial_memory_integrity_events (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid,
  expected_hash text,
  observed_hash text,
  event_type text not null check (event_type in ('mutation','drift','rollback','quarantine','integrity_check')),
  severity text not null default 'warning' check (severity in ('info','warning','high','critical')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.financial_memory_mutations (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid,
  previous_version_id uuid references public.financial_memory_versions(id) on delete set null,
  new_version_id uuid references public.financial_memory_versions(id) on delete set null,
  mutation_type text not null,
  reason text,
  actor_type text not null default 'system',
  actor_id text,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_decision_gates (
  id uuid primary key default gen_random_uuid(),
  agent_loop_run_id uuid,
  agent_loop_step_id uuid,
  action_type text not null,
  risk_level text not null check (risk_level in ('low','medium','high','critical')),
  reversible boolean not null default true,
  amount numeric,
  currency text,
  authorization_present boolean not null default false,
  policy_id text,
  outcome text not null check (outcome in ('ALLOW','ALLOW_WITH_GUARDRAIL','REQUIRE_APPROVAL','ESCALATE','BLOCK')),
  rationale jsonb not null default '{}'::jsonb,
  knowledge_ids uuid[] not null default '{}',
  evidence_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_decision_gates_run on public.agent_decision_gates(agent_loop_run_id, created_at);

create table if not exists public.agent_behaviour_events (
  id uuid primary key default gen_random_uuid(),
  agent_loop_run_id uuid,
  agent_loop_step_id uuid,
  event_type text not null,
  severity text not null check (severity in ('info','warning','high','critical')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_behaviour_events_run on public.agent_behaviour_events(agent_loop_run_id, created_at);

create table if not exists public.financial_agent_drift_signals (
  id uuid primary key default gen_random_uuid(),
  agent_id text,
  metric_name text not null,
  baseline_value numeric,
  observed_value numeric,
  drift_score numeric,
  threshold numeric,
  status text not null default 'open' check (status in ('open','reviewed','dismissed','resolved')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.financial_memory_versions enable row level security;
alter table public.financial_memory_integrity_events enable row level security;
alter table public.financial_memory_mutations enable row level security;
alter table public.agent_decision_gates enable row level security;
alter table public.agent_behaviour_events enable row level security;
alter table public.financial_agent_drift_signals enable row level security;
