# NEXORA v5.05.1 — Data Fetch & Realtime Optimization

- Debounced dashboard realtime reloads to coalesce event bursts.
- Throttled deterministic notification refreshes to 15 seconds and de-duplicated concurrent requests.
- Notification realtime updates no longer trigger a refresh RPC on every notification event.
- Notification refresh API no longer returns raw database error messages.
- No Supabase schema migration required.

Validation: `performance:regression` remains the baseline contract; additional source-level checks should be run after dependency installation.
