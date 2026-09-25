# NEXORA V5.08.6 — Bank Account Dashboard

## Objective
Realign the banking work around the original product goal: connect bank accounts, synchronize balances and transactions, and provide a reliable user-facing financial view.

## Scope
- Powens remains the Open Banking provider for the banking aggregation path.
- Stripe remains isolated in the payment domain and is not used as a substitute for French/European bank aggregation.
- Banking data is normalized into `bank_accounts` and `bank_transactions`.
- Balance snapshots are stored in `bank_balance_snapshots` for future history/charts.
- `/banque` now exposes aggregated balances, account cards, recent transactions, connections and synchronization controls.
- Provider callback routing is no longer hardcoded to Powens in the generic connect route.
- LIA must consume the Financial Data Gateway projection rather than raw banking identifiers.

## Migration
`0087_banking_balance_history.sql`

## Version
`0.1.67`
