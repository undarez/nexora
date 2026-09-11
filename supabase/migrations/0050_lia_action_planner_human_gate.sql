-- v5.02: explicit Action Planner + Human Gate audit boundary.
-- Planning creates proposals only; execution remains separately authorized and human-approved.
alter table public.lia_action_proposals
  add column if not exists planned_at timestamptz,
  add column if not exists execution_key text;
update public.lia_action_proposals set planned_at = coalesce(planned_at, created_at) where planned_at is null;
create index if not exists idx_lia_action_proposals_human_gate on public.lia_action_proposals(user_id,status,expires_at);

comment on table public.lia_action_proposals is 'LIA action plans/proposals. Planning never executes. Human approval and server policy are required before execution.';
