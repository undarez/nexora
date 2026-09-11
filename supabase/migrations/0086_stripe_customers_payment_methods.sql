-- NEXORA V5.08.5: Stripe customer, reusable payment method and refund registry.
create table if not exists public.stripe_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  email text,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.stripe_payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_payment_method_id text not null unique,
  type text not null,
  label text,
  last4 text,
  bank_code text,
  fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, stripe_payment_method_id)
);
create table if not exists public.stripe_refunds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_refund_id text not null unique,
  stripe_payment_intent_id text not null,
  amount bigint not null check(amount > 0),
  currency text not null check(currency ~ '^[a-z]{3}$'),
  status text not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, idempotency_key)
);
alter table public.stripe_customers enable row level security;
alter table public.stripe_payment_methods enable row level security;
alter table public.stripe_refunds enable row level security;
drop policy if exists stripe_customers_owner_select on public.stripe_customers;
create policy stripe_customers_owner_select on public.stripe_customers for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists stripe_payment_methods_owner_select on public.stripe_payment_methods;
create policy stripe_payment_methods_owner_select on public.stripe_payment_methods for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists stripe_refunds_owner_select on public.stripe_refunds;
create policy stripe_refunds_owner_select on public.stripe_refunds for select to authenticated using ((select auth.uid()) = user_id);
create index if not exists stripe_payment_methods_user_idx on public.stripe_payment_methods(user_id, created_at desc);
create index if not exists stripe_refunds_user_idx on public.stripe_refunds(user_id, created_at desc);
