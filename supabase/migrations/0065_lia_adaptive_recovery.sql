-- v5.04.4: bounded adaptive recovery metadata.
alter table public.lia_orchestration_steps
  add column if not exists recovery_strategy text check (recovery_strategy in ('retry_same','switch_to_safe_observation','stop')),
  add column if not exists recovery_reason text;

create index if not exists idx_lia_orchestration_steps_recovery
  on public.lia_orchestration_steps(run_id, recovery_strategy, step_index);

comment on column public.lia_orchestration_steps.recovery_strategy is 'Bounded recovery decision; it never grants permissions or autonomy.';
