-- Gérer Finance: align the audit schema with the current application contract.
-- This migration is intentionally additive so it is safe after 0003 has already
-- been applied on an existing project.

alter table public.agent_runs
  add column if not exists loop_run_id uuid references public.loop_runs(id) on delete set null,
  add column if not exists parent_run_id uuid references public.agent_runs(id) on delete set null,
  add column if not exists agent_key text,
  add column if not exists input_context jsonb not null default '{}'::jsonb,
  add column if not exists output jsonb not null default '{}'::jsonb,
  add column if not exists confidence numeric,
  add column if not exists completed_at timestamptz;

update public.agent_runs
set agent_key = coalesce(agent_key, agent, 'unknown')
where agent_key is null;

update public.agent_runs
set input_context = case
  when input_context = '{}'::jsonb then coalesce(input_summary, '{}'::jsonb)
  else input_context
end,
output = case
  when output = '{}'::jsonb then coalesce(output_summary, '{}'::jsonb)
  else output
end
where input_context = '{}'::jsonb or output = '{}'::jsonb;

alter table public.agent_runs alter column agent_key set not null;
create index if not exists agent_runs_parent_idx on public.agent_runs(parent_run_id, created_at desc);
create index if not exists agent_runs_loop_idx on public.agent_runs(loop_run_id, created_at desc);

comment on table public.agent_runs is 'Audit trail for deterministic/AI financial agent executions, including Paperclip orchestration runs.';
