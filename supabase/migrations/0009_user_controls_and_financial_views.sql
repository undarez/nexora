-- User controls, manual wealth entries and editable forecast inputs.
create table if not exists public.wealth_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  asset_type text not null default 'other' check (asset_type in ('cash','savings','investment','real_estate','crypto','vehicle','other')),
  value numeric(14,2) not null default 0,
  valuation_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.forecast_inputs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  starting_balance numeric(14,2) not null default 0,
  expected_income numeric(14,2) not null default 0,
  fixed_commitments numeric(14,2) not null default 0,
  variable_budget numeric(14,2) not null default 0,
  safety_reserve numeric(14,2) not null default 100,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id, period_start)
);

create table if not exists public.bank_consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid references public.bank_connections(id) on delete set null,
  provider text not null,
  event_type text not null check (event_type in ('requested','granted','revoked','expired','reauthorization_required','disconnected')),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists wealth_entries_user_date_idx on public.wealth_entries(user_id, valuation_date desc);
create index if not exists forecast_inputs_user_period_idx on public.forecast_inputs(user_id, period_start desc);
create index if not exists bank_consent_events_user_date_idx on public.bank_consent_events(user_id, occurred_at desc);

alter table public.wealth_entries enable row level security;
alter table public.forecast_inputs enable row level security;
alter table public.bank_consent_events enable row level security;

create policy "wealth entries own" on public.wealth_entries for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "forecast inputs own" on public.forecast_inputs for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "bank consent events own select" on public.bank_consent_events for select to authenticated using ((select auth.uid()) = user_id);
create policy "bank consent events own insert" on public.bank_consent_events for insert to authenticated with check ((select auth.uid()) = user_id);

create or replace function public.touch_financial_view_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists wealth_entries_touch_updated_at on public.wealth_entries;
create trigger wealth_entries_touch_updated_at before update on public.wealth_entries for each row execute procedure public.touch_financial_view_updated_at();
drop trigger if exists forecast_inputs_touch_updated_at on public.forecast_inputs;
create trigger forecast_inputs_touch_updated_at before update on public.forecast_inputs for each row execute procedure public.touch_financial_view_updated_at();

DO $$ BEGIN
  IF NOT EXISTS (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='wealth_entries') THEN
    alter publication supabase_realtime add table public.wealth_entries;
  END IF;
  IF NOT EXISTS (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='forecast_inputs') THEN
    alter publication supabase_realtime add table public.forecast_inputs;
  END IF;
  IF NOT EXISTS (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='bank_connections') THEN
    alter publication supabase_realtime add table public.bank_connections;
  END IF;
END $$;
