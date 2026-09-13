-- NEXORA v5.06.15: Financial behavioural profile and habit intelligence.
-- Deterministic observations only. Never authorization.
create table if not exists public.lia_financial_behaviour_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  version integer not null default 1,
  confidence numeric(4,3) not null default 0 check (confidence >= 0 and confidence <= 1),
  profile jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','stale','quarantined')),
  observed_from timestamptz,
  observed_to timestamptz,
  last_recomputed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.lia_financial_habit_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  habit_key text not null,
  habit_type text not null check (habit_type in ('merchant','category','income','timing','amount','cashflow','preference')),
  label text not null,
  cadence text check (cadence in ('daily','weekly','monthly','quarterly','irregular')),
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  observation jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  first_observed_at timestamptz,
  last_observed_at timestamptz,
  status text not null default 'candidate' check (status in ('candidate','accepted','stale','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, habit_key)
);
create index if not exists idx_lia_financial_behaviour_profile_status on public.lia_financial_behaviour_profiles(status,last_recomputed_at desc);
create index if not exists idx_lia_financial_habit_observations_user on public.lia_financial_habit_observations(user_id,status,confidence desc,last_observed_at desc);
alter table public.lia_financial_behaviour_profiles enable row level security;
alter table public.lia_financial_habit_observations enable row level security;
drop policy if exists lia_financial_behaviour_profile_owner on public.lia_financial_behaviour_profiles;
create policy lia_financial_behaviour_profile_owner on public.lia_financial_behaviour_profiles for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists lia_financial_habit_observations_owner on public.lia_financial_habit_observations;
create policy lia_financial_habit_observations_owner on public.lia_financial_habit_observations for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
comment on table public.lia_financial_behaviour_profiles is 'Learned financial behaviour profile. Observational, evidence-backed, never authorization.';
comment on table public.lia_financial_habit_observations is 'Fine-grained financial habits inferred deterministically from transaction history. Never authorization.';
