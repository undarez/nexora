-- v5.04.7: connect bounded orchestrations to empirical strategy learning.
alter table public.lia_orchestration_runs
  add column if not exists strategy_key text;
create index if not exists idx_lia_orchestration_runs_strategy
  on public.lia_orchestration_runs(user_id, strategy_key, created_at desc);
comment on column public.lia_orchestration_runs.strategy_key is 'Selected bounded strategy; learning never changes autonomy or permissions.';
