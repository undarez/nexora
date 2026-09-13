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

create policy "lia_memory_agents_owner" on public.lia_memory_agents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.set_lia_memory_agents_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists lia_memory_agents_updated_at on public.lia_memory_agents;
create trigger lia_memory_agents_updated_at
before update on public.lia_memory_agents
for each row execute function public.set_lia_memory_agents_updated_at();
