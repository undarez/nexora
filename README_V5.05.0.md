# NEXORA v5.05.0 — Performance & Architecture Optimization

Base: v5.04.10 Strategy Selection 2.0.

## Optimisations
- Removed automatic LIA cron provisioning from the protected layout. This avoids repeated privileged/runtime queries on every authenticated navigation.
- Added `/api/lia/runtime/bootstrap` for low-frequency cron bootstrap.
- Dashboard triggers bootstrap once per browser session using `sessionStorage`.
- Stabilized Header auth effect with an explicit dependency array and Supabase auth-state listener, preventing repeated auth/context requests on every render.
- Reduced the forced route-loader delay from 3000ms to 350ms so navigation is no longer artificially delayed by 3 seconds.
- Consolidated legacy browser Supabase client wrappers onto the existing singleton client.

## Safety
Cron provisioning remains server-side and authenticated. No secrets are exposed to the client. This version does not alter LIA permissions, autonomy, policies, or financial execution rules.

## Regression
Run:
`npm run performance:regression`
