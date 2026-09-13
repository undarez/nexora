-- v4.61: end-to-end proactive loop. No permission is granted by a signal, use case or skill.
create index if not exists idx_lia_action_proposals_loop_run on public.lia_action_proposals((payload->>'loop_run_id'));
comment on table public.lia_action_proposals is 'Governed action proposals. Proactive loop may create proposals; execution is separately authorized and audited.';
