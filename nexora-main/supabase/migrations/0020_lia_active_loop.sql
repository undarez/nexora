-- LIA Active Loop: proactive observations are proposals, never privileged actions.
create table if not exists public.lia_interventions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  loop_run_id uuid references public.agent_loop_runs(id) on delete set null,
  dedupe_key text not null,
  event_source text not null,
  event_type text not null check (event_type in ('INSERT','UPDATE','DELETE')),
  title text not null,
  message text not null,
  href text not null,
  action_label text not null,
  risk text not null check (risk in ('low','medium','high','critical')),
  status text not null default 'proposed' check (status in ('proposed','viewed','accepted','dismissed','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes')
);

create unique index if not exists lia_interventions_user_dedupe_idx on public.lia_interventions(user_id,dedupe_key);
create index if not exists lia_interventions_user_created_idx on public.lia_interventions(user_id,created_at desc);

alter table public.lia_interventions enable row level security;
drop policy if exists lia_interventions_owner on public.lia_interventions;
create policy lia_interventions_owner on public.lia_interventions for select to authenticated using (user_id = auth.uid());

-- Browser/client cannot manufacture proactive interventions or alter their status.
revoke insert, update, delete on public.lia_interventions from anon, authenticated;
revoke all on public.lia_interventions from public;

