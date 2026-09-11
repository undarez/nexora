-- NEXORA V5.08.4: Stripe payment state + webhook idempotency.
create table if not exists public.stripe_payment_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_payment_intent_id text not null unique,
  idempotency_key text not null,
  status text not null,
  amount bigint not null check (amount > 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  client_secret text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index if not exists stripe_payment_intents_user_idx on public.stripe_payment_intents(user_id, created_at desc);

create table if not exists public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  stripe_payment_intent_id text,
  user_id uuid references auth.users(id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists stripe_webhook_events_payment_intent_idx on public.stripe_webhook_events(stripe_payment_intent_id, created_at desc);
create index if not exists stripe_webhook_events_user_idx on public.stripe_webhook_events(user_id, created_at desc);

alter table public.stripe_payment_intents enable row level security;
alter table public.stripe_webhook_events enable row level security;

drop policy if exists stripe_payment_intents_owner_select on public.stripe_payment_intents;
create policy stripe_payment_intents_owner_select on public.stripe_payment_intents
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists stripe_webhook_events_owner_select on public.stripe_webhook_events;
create policy stripe_webhook_events_owner_select on public.stripe_webhook_events
  for select to authenticated using ((select auth.uid()) = user_id);

comment on table public.stripe_payment_intents is 'NEXORA server-side Stripe payment state. Client secrets are never exposed through database policies.';
comment on table public.stripe_webhook_events is 'Deduplication ledger for verified Stripe webhook events; raw webhook payloads are deliberately not persisted.';
