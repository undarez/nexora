-- NEXORA V5.08.9 — Open Banking webhook ingestion, idempotency and recovery metadata.
create table if not exists public.bank_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  webhook_data_id text not null,
  event_type text not null,
  external_connection_id text,
  external_user_id text,
  status text not null default 'received' check (status in ('received','processed','failed','ignored')),
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(provider, webhook_data_id)
);
create index if not exists bank_webhook_events_connection_idx on public.bank_webhook_events(provider, external_connection_id, received_at desc);
create index if not exists bank_webhook_events_received_idx on public.bank_webhook_events(received_at desc);
alter table public.bank_webhook_events enable row level security;
-- No client-facing policy: webhook ingestion is server/service-role only.

create index if not exists bank_connections_external_idx on public.bank_connections(provider, external_connection_id);
create index if not exists bank_transactions_connection_external_idx on public.bank_transactions(connection_id, external_transaction_id);

comment on table public.bank_webhook_events is 'Server-only idempotency ledger for Open Banking provider webhooks; raw payloads are intentionally not persisted.';
