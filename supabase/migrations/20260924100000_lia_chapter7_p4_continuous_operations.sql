-- Chapter 7 P4: durable autonomous wake state.
-- This table records bounded continuous-operation cycles; it never grants permissions.

create table if not exists public.lia_autonomous_wakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('schedule','event','goal','research','recovery','manual')),
  operation text not null check (operation in ('recover','goal','learn','observe','idle','pending')),
  status text not null check (status in ('running','completed','blocked','failed','abandoned')),
  state jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  next_wake_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.lia_autonomous_wakes enable row level security;
revoke all on public.lia_autonomous_wakes from public, anon, authenticated;

create unique index if not exists lia_autonomous_wakes_one_running_user_idx
  on public.lia_autonomous_wakes(user_id)
  where status = 'running';

create index if not exists lia_autonomous_wakes_user_created_idx
  on public.lia_autonomous_wakes(user_id, created_at desc);

comment on table public.lia_autonomous_wakes is
  'Durable bounded LIA P4 wake cycles. Operational state only; permissions remain controlled by Policy Engine, tool gateway and Human Gate.';
