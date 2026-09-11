-- v4.97: cognitive sessions bridge multiple Nexo exchanges while keeping goal ownership server-side.
create table if not exists public.lia_cognitive_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  active_loop_run_id uuid null references public.agent_loop_runs(id) on delete set null,
  title text not null default 'Session Nexo',
  status text not null default 'active' check (status in ('active','paused','completed')),
  turn_count integer not null default 0 check (turn_count >= 0),
  last_user_message text,
  last_assistant_message text,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lia_cognitive_sessions_user_updated_idx
  on public.lia_cognitive_sessions(user_id, updated_at desc);

alter table public.lia_cognitive_sessions enable row level security;

drop policy if exists lia_cognitive_sessions_select_own on public.lia_cognitive_sessions;
create policy lia_cognitive_sessions_select_own on public.lia_cognitive_sessions
  for select using (auth.uid() = user_id);

drop policy if exists lia_cognitive_sessions_insert_own on public.lia_cognitive_sessions;
create policy lia_cognitive_sessions_insert_own on public.lia_cognitive_sessions
  for insert with check (auth.uid() = user_id);

drop policy if exists lia_cognitive_sessions_update_own on public.lia_cognitive_sessions;
create policy lia_cognitive_sessions_update_own on public.lia_cognitive_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.lia_cognitive_sessions from anon;
grant select, insert, update on public.lia_cognitive_sessions to authenticated;

create or replace function public.lia_touch_cognitive_session(p_session_id uuid, p_user_id uuid, p_loop_run_id uuid, p_user_message text, p_assistant_message text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.lia_cognitive_sessions
  set active_loop_run_id = p_loop_run_id,
      turn_count = turn_count + 1,
      last_user_message = left(p_user_message, 2000),
      last_assistant_message = left(p_assistant_message, 4000),
      updated_at = now()
  where id = p_session_id and user_id = p_user_id;
$$;

revoke execute on function public.lia_touch_cognitive_session(uuid, uuid, uuid, text, text) from public, anon;
grant execute on function public.lia_touch_cognitive_session(uuid, uuid, uuid, text, text) to authenticated;
