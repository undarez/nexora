# NEXORA V5.06.15 — Behavioural Financial Brain

This release builds on V5.06.14 and the Financial Agent Memory Pipeline v2.

## Added
- Deterministic financial behavioural profile from transaction history.
- Fine-grained habit observations: merchant, timing, amount, cashflow, category, income and preference types.
- Cadence inference: daily / weekly / monthly / quarterly / irregular.
- Confidence, evidence transaction IDs, first/last observation and stale state.
- Behavioural profile: sample size, monthly spend/income medians, net median, recurring habit count, spending weekdays/hours and top recurring merchants.
- `/habitudes` protected UI.
- `/api/lia/behaviour` GET/POST endpoint.
- Brain context now exposes behavioural profile and behavioural habits.

## Governance
- Behavioural observations are not authorization.
- No LLM is used to calculate habits.
- External knowledge cannot overwrite policy.
- Existing Memory Pipeline v2 versioning, integrity, rollback and Decision Gate remain authoritative.
