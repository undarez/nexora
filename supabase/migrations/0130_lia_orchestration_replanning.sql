alter table public.lia_orchestration_runs
  add column if not exists plan_version integer not null default 1,
  add column if not exists replan_count integer not null default 0,
  add column if not exists replan_reason text,
  add column if not exists replanned_at timestamptz;

create index if not exists idx_lia_orchestration_runs_replan
  on public.lia_orchestration_runs (user_id, replan_count, replanned_at);

comment on column public.lia_orchestration_runs.plan_version is 'Monotonic version of the active orchestration task graph.';
comment on column public.lia_orchestration_runs.replan_count is 'Number of governed replanning passes for this orchestration run.';
comment on column public.lia_orchestration_runs.replan_reason is 'Last bounded reason that caused replanning.';
comment on column public.lia_orchestration_runs.replanned_at is 'Timestamp of the latest governed replanning pass.';
