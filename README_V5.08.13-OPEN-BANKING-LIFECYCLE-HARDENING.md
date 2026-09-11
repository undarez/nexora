# NEXORA V5.08.13 — Open Banking Lifecycle Hardening

- OAuth callback state is consumed after correlation to reduce replay risk.
- `/api/banking/connect` uses the provider adapter callback path instead of hard-coding Powens.
- Banking synchronization stops when the provider-reported consent expiry has passed and marks the connection `needs_reauth`.
- Account and connection revocation remain provider-backed and idempotent through the existing lifecycle.
- No raw banking credentials or webhook payloads are stored or exposed.

Validation: `npm run open-banking:lifecycle`.
