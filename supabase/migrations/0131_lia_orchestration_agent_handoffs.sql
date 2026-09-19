alter table public.lia_orchestration_steps
  add column if not exists handoff_context jsonb not null default '{}'::jsonb,
  add column if not exists evidence_refs jsonb not null default '[]'::jsonb;

create index if not exists idx_lia_orchestration_steps_agent_lane
  on public.lia_orchestration_steps (run_id, agent_key, step_index);

comment on column public.lia_orchestration_steps.handoff_context is 'Structured governed handoff from the previous task-graph step.';
comment on column public.lia_orchestration_steps.evidence_refs is 'Bounded evidence references produced or consumed by the step.';
