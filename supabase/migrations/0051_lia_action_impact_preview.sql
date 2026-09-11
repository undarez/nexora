-- v5.03: impact preview metadata. Preview is informational only and never authorizes execution.
alter table public.lia_action_proposals
  add column if not exists impact_preview jsonb,
  add column if not exists impact_previewed_at timestamptz;
comment on column public.lia_action_proposals.impact_preview is 'Informational, server-generated impact preview; never an execution authorization.';
