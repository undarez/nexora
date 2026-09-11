-- NEXORA V5.08.21 — first-party product analytics
-- No financial values, page content, query strings or third-party identifiers are stored.
create table if not exists public.product_analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  event_name text not null check (event_name in ('page_view','feature_view')),
  route text not null check (char_length(route) between 1 and 200),
  feature_key text,
  occurred_at timestamptz not null default now(),
  constraint product_analytics_events_session_chk check (session_id ~ '^[A-Za-z0-9_-]{16,80}$')
);

create index if not exists product_analytics_events_occurred_idx on public.product_analytics_events(occurred_at desc);
create index if not exists product_analytics_events_user_occurred_idx on public.product_analytics_events(user_id, occurred_at desc);
create index if not exists product_analytics_events_feature_idx on public.product_analytics_events(feature_key, occurred_at desc);

alter table public.product_analytics_events enable row level security;

-- Authenticated users may record only their own minimal product telemetry.
drop policy if exists product_analytics_events_insert_own on public.product_analytics_events;
create policy product_analytics_events_insert_own on public.product_analytics_events
  for insert to authenticated
  with check (auth.uid() = user_id);

-- Deliberately no SELECT/UPDATE/DELETE policies for end users.
-- Admin analytics reads use the server-only Supabase secret through protected routes.
