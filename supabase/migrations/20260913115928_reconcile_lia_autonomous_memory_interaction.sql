-- Reconciliation migration for the autonomous tool, interaction intelligence and Letta mapping layers.
-- Applied to Supabase as 20260913115928_reconcile_lia_autonomous_memory_interaction.

create table if not exists public.lia_dynamic_tools (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null,
  kind text not null check (kind in ('composite-read')),
  schema jsonb not null default '{"type":"object","properties":{},"additionalProperties":false}'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('candidate','active','disabled','rejected')),
  safety jsonb not null default '{}'::jsonb,
  created_by text not null default 'agent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);

alter table public.lia_dynamic_tools enable row level security;
drop policy if exists "lia dynamic tools own" on public.lia_dynamic_tools;
create policy "lia dynamic tools own" on public.lia_dynamic_tools for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create index if not exists lia_dynamic_tools_user_status_idx on public.lia_dynamic_tools(user_id, status, created_at desc);

alter table public.knowledge_items
  add column if not exists content text,
  add column if not exists source_url text,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb,
  add column if not exists retrieved_at timestamptz;

alter table public.knowledge_sources enable row level security;
alter table public.knowledge_items enable row level security;
drop policy if exists "knowledge sources readable" on public.knowledge_sources;
create policy "knowledge sources readable" on public.knowledge_sources for select to authenticated using (true);
drop policy if exists "knowledge items readable" on public.knowledge_items;
create policy "knowledge items readable" on public.knowledge_items for select to authenticated using (true);
create index if not exists knowledge_items_hash_idx on public.knowledge_items(content_hash);
create index if not exists knowledge_items_retrieved_idx on public.knowledge_items(retrieved_at desc);

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
  constraint lia_interaction_events_event_type check (event_type in ('page_focus','page_leave','view_entity','search','open_transaction','open_budget','edit_budget','create_item','delete_item','change_forecast','view_indicator','submit_action','repeat_view','hesitation')),
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
select user_id, session_id, max(occurred_at) as last_event_at, count(*)::int as event_count,
       count(*) filter (where occurred_at > now() - interval '15 minutes')::int as recent_event_count,
       array_agg(distinct event_type) as event_types, array_agg(distinct path) as paths
from public.lia_interaction_events
where occurred_at > now() - interval '24 hours'
group by user_id, session_id;

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
create index if not exists lia_user_activity_user_created_idx on public.lia_user_activity(user_id, created_at desc);
create index if not exists lia_user_activity_session_created_idx on public.lia_user_activity(session_id, created_at desc);
alter table public.lia_user_activity enable row level security;
drop policy if exists "lia activity own rows" on public.lia_user_activity;
create policy "lia activity own rows" on public.lia_user_activity for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.lia_memory_agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'letta' check (provider in ('letta')),
  external_agent_id text not null,
  status text not null default 'active' check (status in ('active','disabled','error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider),
  unique (provider, external_agent_id)
);
create index if not exists lia_memory_agents_user_idx on public.lia_memory_agents(user_id);
alter table public.lia_memory_agents enable row level security;
drop policy if exists "lia_memory_agents_owner" on public.lia_memory_agents;
create policy "lia_memory_agents_owner" on public.lia_memory_agents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create or replace function public.set_lia_memory_agents_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists lia_memory_agents_updated_at on public.lia_memory_agents;
create trigger lia_memory_agents_updated_at before update on public.lia_memory_agents for each row execute function public.set_lia_memory_agents_updated_at();
