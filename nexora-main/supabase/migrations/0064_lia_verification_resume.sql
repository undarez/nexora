-- v5.04.3: deterministic verification + safe Human Gate resume metadata.
alter table public.lia_orchestration_steps
  add column if not exists retry_count integer not null default 0 check (retry_count between 0 and 3),
  add column if not exists last_error text,
  add column if not exists verified_at timestamptz;

create index if not exists idx_lia_orchestration_steps_pending
  on public.lia_orchestration_steps(run_id, status, step_index);

comment on column public.lia_orchestration_steps.retry_count is 'Bounded retries; verification never grants new permissions.';
comment on column public.lia_orchestration_steps.verified_at is 'Timestamp of deterministic verification success.';
