-- v4.99: durable multi-turn cognitive session timeline.
create table if not exists public.lia_cognitive_session_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.lia_cognitive_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  turn_index integer not null check (turn_index > 0),
  loop_run_id uuid null references public.agent_loop_runs(id) on delete set null,
  question text not null,
  answer_preview text,
  loop_status text not null default 'completed',
  goal_state text,
  progress integer not null default 0 check (progress between 0 and 100),
  decision text,
  created_at timestamptz not null default now()
);
create index if not exists lia_cognitive_session_turns_session_idx on public.lia_cognitive_session_turns(session_id, turn_index desc);
create index if not exists lia_cognitive_session_turns_user_idx on public.lia_cognitive_session_turns(user_id, created_at desc);
alter table public.lia_cognitive_session_turns enable row level security;
drop policy if exists lia_cognitive_session_turns_select_own on public.lia_cognitive_session_turns;
create policy lia_cognitive_session_turns_select_own on public.lia_cognitive_session_turns for select using (auth.uid() = user_id);
drop policy if exists lia_cognitive_session_turns_insert_own on public.lia_cognitive_session_turns;
create policy lia_cognitive_session_turns_insert_own on public.lia_cognitive_session_turns for insert with check (auth.uid() = user_id);
revoke all on public.lia_cognitive_session_turns from anon;
grant select, insert on public.lia_cognitive_session_turns to authenticated;
