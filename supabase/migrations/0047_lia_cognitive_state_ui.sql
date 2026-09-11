-- v4.98: optimize server-governed reads used by the Nexo cognitive timeline.
create index if not exists agent_evidence_run_type_created_idx
  on public.agent_evidence(loop_run_id, evidence_type, created_at desc);
