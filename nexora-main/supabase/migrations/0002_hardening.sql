-- Gérer Finance: hardening, indexes, timestamps and rule version history.
create index if not exists transactions_user_date_idx on public.transactions(user_id, occurred_at desc);
create index if not exists transactions_account_date_idx on public.transactions(account_id, occurred_at desc);
create index if not exists forecasts_user_created_idx on public.forecasts(user_id, created_at desc);
create index if not exists learning_user_created_idx on public.learning_events(user_id, created_at desc);
create index if not exists recommendations_user_created_idx on public.recommendations(user_id, created_at desc);
create index if not exists alerts_user_created_idx on public.alerts(user_id, created_at desc);

create table if not exists public.rule_versions (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.rules(id) on delete cascade,
  version int not null,
  previous_value jsonb,
  new_value jsonb not null,
  evidence jsonb not null default '{}'::jsonb,
  approved_by text,
  created_at timestamptz not null default now(),
  unique(rule_id, version)
);

alter table public.rule_versions enable row level security;
-- Rules are system-owned in this MVP. Only service-role/server-side code should mutate them.
-- No permissive client policy is created here.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$ begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();
