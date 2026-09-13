# NEXORA V5.08.12 — Open Banking Account & Connection Revocation

## Goal
Make Open Banking consent withdrawal explicit and provider-backed at both account and connection level.

## Account access revocation
- Banque page exposes **Révoquer l'accès** per bank account.
- NEXORA calls the provider before changing local state.
- Powens uses `PUT .../accounts/{ids}?all` with `{ disabled: true }`.
- Local `bank_accounts.status` becomes `disabled` and `access_revoked_at` is recorded.
- Historical transactions are preserved locally for financial continuity; the account stops being part of active synchronization.

## Connection revocation
- Existing **Révoquer** action deletes the remote Powens connection first.
- Only after provider success are local connection/accounts marked `revoked`.
- Historical local records are retained; future synchronization is blocked.

## Webhooks
- `CONNECTION_DELETED` marks the connection and all local accounts as revoked.
- `ACCOUNT_DISABLED` and `ACCOUNT_ENABLED` update local account access state.
- Webhook idempotency and HMAC verification remain mandatory.

## Security
- No bank credentials enter the browser.
- No provider secret is exposed client-side.
- Revocation is fail-closed: local access is not marked revoked when the provider deletion fails.

## Verification
Run:

`npm run open-banking:revocation`

Full Next build/typecheck still requires the project's dependencies to be installed.
