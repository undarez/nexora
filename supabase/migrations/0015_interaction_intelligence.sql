create table if not exists public.lia_interaction_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  event_type text not null,
  path text not null,
  feature_key text,
  target_key text,
  value_number integer,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint lia_interaction_events_event_type check (event_type in (
    'page_focus','page_leave','view_entity','search','open_transaction','open_budget',
    'edit_budget','create_item','delete_item','change_forecast','view_indicator','submit_action',
    'repeat_view','hesitation'
  )),
  constraint lia_interaction_events_path check (path ~ '^/[A-Za-z0-9_./#?=&-]{0,299}$'),
  constraint lia_interaction_events_session check (session_id ~ '^[A-Za-z0-9_-]{16,80}$'),
  constraint lia_interaction_events_target check (target_key is null or target_key ~ '^[a-z0-9_.:-]{1,120}$'),
  constraint lia_interaction_events_value check (value_number is null or abs(value_number) <= 1000000)
);

create index if not exists lia_interaction_events_user_time_idx on public.lia_interaction_events(user_id, occurred_at desc);
create index if not exists lia_interaction_events_user_session_idx on public.lia_interaction_events(user_id, session_id, occurred_at desc);
create index if not exists lia_interaction_events_user_type_idx on public.lia_interaction_events(user_id, event_type, occurred_at desc);

alter table public.lia_interaction_events enable row level security;
drop policy if exists lia_interaction_events_owner on public.lia_interaction_events;
create policy lia_interaction_events_owner on public.lia_interaction_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace view public.lia_recent_interaction_summary as
select user_id,
       session_id,
       max(occurred_at) as last_event_at,
       count(*)::int as event_count,
       count(*) filter (where occurred_at > now() - interval '15 minutes')::int as recent_event_count,
       array_agg(distinct event_type) as event_types,
       array_agg(distinct path) as paths
from public.lia_interaction_events
where occurred_at > now() - interval '24 hours'
group by user_id, session_id;
