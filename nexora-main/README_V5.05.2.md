# NEXORA v5.05.2 — Database Query Optimization

Targeted Supabase indexes added after inspecting the live `budgetlink` schema and application query patterns.

Added migration `0071_performance_query_indexes.sql`:
- `accounts(user_id, name)` for account listing/order queries.
- `goals(user_id, priority, target_date)` for goal lists ordered by priority.
- `lia_action_observations(proposal_id, created_at desc)` for proposal lifecycle lookups.
- `lia_action_observations(loop_run_id, created_at desc)` for orchestration/loop observations.
- `lia_decision_records(procedure_id, created_at desc)` for procedure decision history.
- `transaction_envelope_links(transaction_id, created_at desc)` for transaction allocation lookups.

No data migration. No reset. Migration was applied to the `budgetlink` project.
