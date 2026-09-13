-- NEXORA V5.08.23 — runtime stability hardening.
-- Safe/idempotent loop step recording is implemented in application code; this
-- migration documents and verifies the database invariant already required.

create index if not exists agent_loop_steps_run_order_idx
  on public.agent_loop_steps(loop_run_id, step_order);

comment on constraint agent_loop_steps_loop_run_id_step_order_key on public.agent_loop_steps is
  'One durable step per loop/order; application treats duplicate inserts idempotently.';
