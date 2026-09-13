-- NEXORA billing: Stripe-managed premium entitlement.
create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  stripe_price_id text,
  status text not null default 'inactive',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);
create index if not exists billing_subscriptions_user_status_idx on public.billing_subscriptions(user_id, status);
create index if not exists billing_subscriptions_customer_idx on public.billing_subscriptions(stripe_customer_id);
alter table public.billing_subscriptions enable row level security;
drop policy if exists billing_subscriptions_owner_select on public.billing_subscriptions;
create policy billing_subscriptions_owner_select on public.billing_subscriptions for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.billing_subscriptions from authenticated;
revoke all on public.billing_subscriptions from anon;
