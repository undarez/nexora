# NEXORA V5.08.29 — Open Banking final audit

## Objective
Finalize the Powens Open Banking lifecycle without creating a second financial source of truth.

## Hardening
- NEXORA enforces a 90-day maximum authorization window.
- `needs_reauth` connections are blocked from further synchronization until reconnection.
- Provider consent expiration remains a second, stricter gate when applicable.
- Legacy active connections missing a deadline receive a 90-day deadline after a successful sync.
- Provider-side revocation remains server-side and cascades to local bank accounts.
- Powens webhooks remain signature-verified, time-bounded and idempotent.
- Workspace access is checked before enterprise banking connection creation.
- Existing J-30/J-14/J-7/J-1 and expiry notification milestones remain in the database notification function.

## No new financial model
The audit deliberately keeps the existing unified financial context and bank tables. No parallel enterprise ledger is introduced.

## Validation
Run:

```bash
npm run banking:final-audit
npm run enterprise:rebuild
npm run build
```
