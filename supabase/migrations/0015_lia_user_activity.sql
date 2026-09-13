create table if not exists public.lia_user_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  event_type text not null check (event_type in ('session_start','page_view','page_focus','page_leave','copilot_open','copilot_message')),
  path text not null default '/',
  page text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lia_user_activity_user_created_idx
  on public.lia_user_activity(user_id, created_at desc);
create index if not exists lia_user_activity_session_created_idx
  on public.lia_user_activity(session_id, created_at desc);

alter table public.lia_user_activity enable row level security;

drop policy if exists "lia activity own rows" on public.lia_user_activity;
create policy "lia activity own rows"
  on public.lia_user_activity
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.lia_user_activity is 'Privacy-scoped product activity used by Nexora copilot for page-aware assistance; no raw financial payloads.';
