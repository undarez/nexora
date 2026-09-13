-- v4.66: durable post-action observation/evaluation. Observations are server-written and immutable to clients.
create table if not exists public.lia_action_observations (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.lia_action_proposals(id) on delete cascade,
  loop_run_id uuid references public.agent_loop_runs(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  action_key text not null,
  expected jsonb not null default '{}'::jsonb,
  observed jsonb not null default '{}'::jsonb,
  outcome text not null check (outcome in ('verified','mismatch','inconclusive','failed')),
  checks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_lia_action_observations_user_time on public.lia_action_observations(user_id, created_at desc);
create unique index if not exists ux_lia_action_observations_proposal on public.lia_action_observations(proposal_id);
alter table public.lia_action_observations enable row level security;
drop policy if exists lia_action_observations_owner_read on public.lia_action_observations;
create policy lia_action_observations_owner_read on public.lia_action_observations for select to authenticated using (user_id=auth.uid());
revoke insert, update, delete on public.lia_action_observations from public, anon, authenticated;
comment on table public.lia_action_observations is 'Immutable server-side evidence of actual post-action state; evaluation is distinct from authorization.';
