-- NEXORA V5.08.13 — Open Banking lifecycle hardening.
-- One-time OAuth state consumption prevents callback replay within the state TTL.
-- Existing JSONB metadata remains backward-compatible; these indexes improve lifecycle lookups.
create index if not exists bank_connections_consent_expiry_idx
  on public.bank_connections(user_id, consent_expires_at)
  where consent_expires_at is not null;

comment on column public.bank_connections.consent_expires_at is
  'Provider-reported Open Banking consent expiry. Synchronization must stop and request re-authentication after this instant.';
