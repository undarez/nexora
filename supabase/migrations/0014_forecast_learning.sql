-- Forecast learning loop: explicit monthly review of hypothesis vs observed cashflow.
create table if not exists public.forecast_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  expected_income numeric(14,2) not null default 0,
  expected_expenses numeric(14,2) not null default 0,
  actual_income numeric(14,2) not null default 0,
  actual_expenses numeric(14,2) not null default 0,
  planned_net numeric(14,2) not null default 0,
  actual_net numeric(14,2) not null default 0,
  variance numeric(14,2) not null default 0,
  assessment text not null default 'pending' check (assessment in ('pending','better_than_expected','on_track','worse_than_expected')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, period_start)
);

create index if not exists forecast_reviews_user_period_idx
  on public.forecast_reviews(user_id, period_start desc);

alter table public.forecast_reviews enable row level security;
drop policy if exists "forecast reviews own" on public.forecast_reviews;
create policy "forecast reviews own" on public.forecast_reviews
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.touch_forecast_reviews_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists forecast_reviews_touch_updated_at on public.forecast_reviews;
create trigger forecast_reviews_touch_updated_at
before update on public.forecast_reviews
for each row execute procedure public.touch_forecast_reviews_updated_at();
