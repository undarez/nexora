-- Agent identity and authorization hardening.
-- The LIA principal is separate from the human user identity at the policy layer.
create table if not exists public.lia_agent_identities (
  agent_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_key text not null check (agent_key = 'lia'),
  role text not null check (role = 'financial_assistant'),
  organization_id text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, agent_key)
);

alter table public.lia_agent_identities enable row level security;
revoke all on public.lia_agent_identities from public, anon, authenticated;

create index if not exists idx_lia_agent_identity_user on public.lia_agent_identities(user_id);

comment on table public.lia_agent_identities is 'Server-governed LIA principals. Client roles cannot read or mutate agent identities.';

-- Keep the governance table server-only as well.
revoke all on public.lia_tool_policies from public, anon, authenticated;
