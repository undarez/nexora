# NEXORA v5.07.3 — Secure Financial Vault L3

Adds the first secure boundary for sensitive financial data.

## Guarantees
- Application-side AES-256-GCM encryption for sensitive payloads.
- Browser API exposes metadata/masked labels only; never ciphertext keys or decrypted payloads.
- LIA is not given raw vault payloads.
- Level 3 is the minimum sensitivity enforced by the schema.
- `NEXORA_VAULT_KEY` is server-only and must be 32 bytes (64 hex chars or base64 encoding).
- No banking provider is connected by this migration; this is the secure storage boundary for the future Open Banking adapter.

## Next
The next banking step should be a provider gateway that imports normalized account data into the vault without leaking credentials, then projects only minimal financial facts to LIA.
