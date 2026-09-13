-- NEXORA: Financial Autopilot v1. Deterministic observation/prediction/opportunity state.
create table if not exists public.lia_financial_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prediction_key text not null,
  prediction_type text not null check (prediction_type in ('recurring_expense','cashflow')),
  label text not null,
  amount numeric(14,2) not null default 0,
  due_date date,
  confidence numeric(5,4) not null default 0 check (confidence between 0 and 1),
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','dismissed','expired','realized')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, prediction_key)
);
create index if not exists lia_financial_predictions_user_due_idx on public.lia_financial_predictions(user_id, status, due_date);
alter table public.lia_financial_predictions enable row level security;
drop policy if exists "lia financial predictions own" on public.lia_financial_predictions;
create policy "lia financial predictions own" on public.lia_financial_predictions for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.lia_financial_opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_key text not null,
  opportunity_type text not null,
  severity text not null check (severity in ('info','warning','danger')),
  title text not null,
  message text not null,
  estimated_impact numeric(14,2),
  confidence numeric(5,4) not null default 0 check (confidence between 0 and 1),
  reversible boolean not null default true,
  requires_human_approval boolean not null default true,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','accepted','dismissed','completed','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, opportunity_key)
);
create index if not exists lia_financial_opportunities_user_status_idx on public.lia_financial_opportunities(user_id, status, severity);
alter table public.lia_financial_opportunities enable row level security;
drop policy if exists "lia financial opportunities own" on public.lia_financial_opportunities;
create policy "lia financial opportunities own" on public.lia_financial_opportunities for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.lia_autopilot_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  auto_classify_transactions boolean not null default true,
  auto_classify_min_confidence numeric(5,4) not null default 0.90 check (auto_classify_min_confidence between 0 and 1),
  proactive_notifications boolean not null default true,
  contract_review_days integer not null default 60 check (contract_review_days between 7 and 365),
  updated_at timestamptz not null default now()
);
alter table public.lia_autopilot_preferences enable row level security;
drop policy if exists "lia autopilot preferences own" on public.lia_autopilot_preferences;
create policy "lia autopilot preferences own" on public.lia_autopilot_preferences for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create or replace function public.touch_lia_autopilot_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists lia_financial_predictions_touch on public.lia_financial_predictions;
create trigger lia_financial_predictions_touch before update on public.lia_financial_predictions for each row execute procedure public.touch_lia_autopilot_updated_at();
drop trigger if exists lia_financial_opportunities_touch on public.lia_financial_opportunities;
create trigger lia_financial_opportunities_touch before update on public.lia_financial_opportunities for each row execute procedure public.touch_lia_autopilot_updated_at();

comment on table public.lia_financial_predictions is 'Predictions made by deterministic LIA financial autopilot; never actual transactions.';
comment on table public.lia_financial_opportunities is 'Proactive financial opportunities/risks proposed by LIA; sensitive actions remain human-gated.';
