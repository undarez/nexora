-- NEXORA: optional self-hosted Letta persistent-memory mapping.
-- Letta is a memory provider, never an authorization source.
create table if not exists public.lia_memory_agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('letta')),
  external_agent_id text not null,
  status text not null default 'active' check (status in ('active','disabled','error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider),
  unique(provider, external_agent_id)
);

create index if not exists idx_lia_memory_agents_user
  on public.lia_memory_agents(user_id);

alter table public.lia_memory_agents enable row level security;

drop policy if exists lia_memory_agents_owner_select on public.lia_memory_agents;
create policy lia_memory_agents_owner_select
  on public.lia_memory_agents for select to authenticated
  using (user_id = auth.uid());

revoke all on public.lia_memory_agents from anon, authenticated;
grant select on public.lia_memory_agents to authenticated;

create or replace function public.lia_touch_memory_agent()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_lia_memory_agents_updated_at on public.lia_memory_agents;
create trigger trg_lia_memory_agents_updated_at
before update on public.lia_memory_agents
for each row execute function public.lia_touch_memory_agent();

comment on table public.lia_memory_agents is
  'Mapping privé utilisateur vers un agent Letta. Letta ne décide jamais des permissions financières.';
