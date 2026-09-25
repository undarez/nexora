# NEXORA v5.07.5 — Personal Financial Model

Unifies the secure financial projection, goals, budget scenario and accepted behavioural profile into one read-only user context for LIA.

## Security
- No raw account/transaction identifiers are exposed.
- No vault payload is exposed.
- Personalization does not grant authority.
- Policy Engine and Decision Gate remain authoritative.

## API
`GET /api/lia/personal-financial-model`

## Chat integration
The same compact model is added to the server-side LIA context. It does not replace the cognitive loop or create a second brain.

## Validation
`lia:personal-financial-model` regression: PASS.
