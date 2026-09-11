# NEXORA v5.06.24 — Critique Kernel

Adds a deterministic self-review layer between Planning and execution/language synthesis.

## Guarantees
- Never authorizes financial writes.
- Blocks plans with missing required evidence, missing external verification, or missing human gate for high/critical risk.
- Preserves Policy Engine and Decision Gate as authoritative.
- Records critique in the agent loop when available.
- No Supabase migration required.

## Regression
`npm run lia:critique-kernel`
