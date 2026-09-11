# NEXORA V5.08.10 — Financial Single Source & Cross-Domain Consistency

## Objective
Stop duplicating financial calculations across pages. Dashboard, Forecasts and Pilotage now consume the same read-only `/api/finance/unified-context` projection for core KPIs. Detail pages remain responsible for their own editing workflows.

## Page roles
- Dashboard: global situation and decisions; no financial ledger reads of its own.
- Banque: connected accounts, consent, synchronization and banking detail.
- Transactions: one chronological view of manual + imported bank operations.
- Budget: planning/editing and envelope allocation.
- Prévisions: editable forecast assumptions + observed actuals from unified context.
- Pilotage: actions, alerts and recurring analysis; current-month KPIs from unified context.
- Patrimoine: declared assets, deliberately separate from cash liquidity.

## Source of truth
`src/lib/finance/unified-financial-context.ts` is the cross-domain read model. It keeps bank and manual ledgers distinct, aggregates currencies safely, exposes budget envelopes/fixed commitments, and computes the end-of-month projection from the plan.

## Important correction
The previous projection subtracted only the unspent budget remainder. That could make higher observed spending improve the projection. V5.08.10 projects the planned end balance using the full planned envelope spend.

## Regression
Run `npm run financial:cross-domain` after dependency installation.
