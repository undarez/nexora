-- Gérer Finance: persistent budget planning, fixed expenses and monthly scenarios.
create table if not exists public.fixed_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  sector text not null default 'Autres',
  icon text not null default 'wallet',
  amount numeric(14,2) not null check (amount >= 0),
  due_day smallint check (due_day between 1 and 31),
  recurrence text not null default 'monthly' check (recurrence in ('monthly','one_off')),
  effective_from date not null default current_date,
  effective_until date,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_until is null or effective_until >= effective_from)
);
create index if not exists fixed_expenses_user_dates_idx on public.fixed_expenses(user_id, effective_from, effective_until, is_active);
alter table public.fixed_expenses enable row level security;
drop policy if exists "fixed expenses own" on public.fixed_expenses;
create policy "fixed expenses own" on public.fixed_expenses for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.budget_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  name text not null default 'Scénario actuel',
  income numeric(14,2) not null default 0,
  starting_balance numeric(14,2) not null default 0,
  safety_reserve numeric(14,2) not null default 100,
  extra_expense numeric(14,2) not null default 0,
  weeks_remaining numeric(5,2) not null default 4,
  envelopes jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id, period_start)
);
create index if not exists budget_scenarios_user_period_idx on public.budget_scenarios(user_id, period_start desc);
alter table public.budget_scenarios enable row level security;
drop policy if exists "budget scenarios own" on public.budget_scenarios;
create policy "budget scenarios own" on public.budget_scenarios for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.touch_budget_planning_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists fixed_expenses_touch_updated_at on public.fixed_expenses;
create trigger fixed_expenses_touch_updated_at before update on public.fixed_expenses for each row execute procedure public.touch_budget_planning_updated_at();
drop trigger if exists budget_scenarios_touch_updated_at on public.budget_scenarios;
create trigger budget_scenarios_touch_updated_at before update on public.budget_scenarios for each row execute procedure public.touch_budget_planning_updated_at();

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='fixed_expenses') then
    alter publication supabase_realtime add table public.fixed_expenses;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='budget_scenarios') then
    alter publication supabase_realtime add table public.budget_scenarios;
  end if;
end $$;
