# NEXORA V5.08.9 — Open Banking completion & financial UX cleanup

## Objective
Finish the Powens Open Banking lifecycle and stop multiplying financial pages. Existing pages remain canonical; cross-domain data is shared through the unified financial context.

## Open Banking
- Powens Connect / Reconnect / Manage flows.
- Provider-aware disconnect that deletes the remote connection before revoking the local link.
- Callback state expiry and error handling.
- Account-scoped transaction synchronization with pagination instead of a user-wide transaction dump.
- Powens webhook ingestion with HMAC validation, replay window and idempotency ledger.
- No raw webhook payload persisted.

## UX / page consolidation
- No new user-facing finance page added.
- Existing `Banque` remains the account/connection cockpit.
- Existing `Transactions` becomes the unified transaction view: manual + Open Banking, with imported bank rows read-only.
- Existing Budget / Dashboard / Pilotage / Prévisions / Patrimoine keep their canonical roles and consume the cross-domain summary.

## Cleanup
- Removed duplicated Powens adapter properties that caused TypeScript errors.
- Hardened pagination URL validation.
- Added server-only webhook event ledger and indexes.

## Environment
`POWENS_WEBHOOK_SECRET` must match the HMAC secret configured for the Powens webhook.
