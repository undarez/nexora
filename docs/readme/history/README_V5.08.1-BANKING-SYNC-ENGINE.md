# NEXORA V5.08.1 — Banking Sync Engine

- Provider-neutral sync engine.
- Normalizes accounts and transactions before persistence.
- Upserts by provider external identifiers to prevent duplicates.
- Records sync runs and bounded history.
- Fail-closed when no provider adapter is configured.
- Never accepts raw bank credentials through the app.
- Never exposes raw provider payloads to LIA.
- No fake synchronization or fake banking data.
- Supabase migration: `0084_banking_sync_runs.sql`.

## Validation

Run `npm run build`, then `npm run dev`.
Without a provider adapter, `/api/banking/sync` must return `503` with `provider_adapter_not_configured` rather than inventing data.
