-- Chapter 7 — governed task graph metadata.
-- Additive only: existing orchestration runs remain compatible.
alter table public.lia_orchestration_steps
  add column if not exists parent_step_id uuid references public.lia_orchestration_steps(id) on delete set null,
  add column if not exists depends_on integer[] not null default '{}'::integer[],
  add column if not exists agent_key text,
  add column if not exists execution_policy jsonb not null default '{}'::jsonb;

create index if not exists lia_orchestration_steps_parent_idx
  on public.lia_orchestration_steps(parent_step_id);

create index if not exists lia_orchestration_steps_run_index_idx
  on public.lia_orchestration_steps(run_id, step_index);

comment on column public.lia_orchestration_steps.depends_on is 'Chapter 7 task-graph dependencies expressed as step indexes.';
comment on column public.lia_orchestration_steps.agent_key is 'Governed execution lane selected for the step; informational and policy-bound.';
comment on column public.lia_orchestration_steps.execution_policy is 'Bounded execution metadata; never grants permissions.';
