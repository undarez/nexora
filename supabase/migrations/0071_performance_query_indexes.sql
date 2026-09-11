-- v5.05.2: targeted indexes for high-frequency authenticated reads and lifecycle lookups.
-- No data changes; safe additive indexes only.
create index if not exists accounts_user_name_idx on public.accounts(user_id, name);
create index if not exists goals_user_priority_idx on public.goals(user_id, priority, target_date);
create index if not exists lia_action_observations_proposal_time_idx on public.lia_action_observations(proposal_id, created_at desc);
create index if not exists lia_action_observations_loop_time_idx on public.lia_action_observations(loop_run_id, created_at desc);
create index if not exists lia_decision_records_procedure_created_idx on public.lia_decision_records(procedure_id, created_at desc);
create index if not exists transaction_envelope_links_transaction_idx on public.transaction_envelope_links(transaction_id, created_at desc);
