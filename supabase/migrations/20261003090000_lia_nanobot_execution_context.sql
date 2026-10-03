create table if not exists public.lia_nanobot_execution_contexts (
  id uuid primary key default gen_random_uuid(),
  nonce text not null unique,
  token_hash text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id text not null,
  organization_id text not null,
  goal_id text,
  run_id text,
  session_id text not null,
  autonomy_level smallint not null check (autonomy_level between 0 and 8),
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists lia_nanobot_execution_contexts_user_idx
  on public.lia_nanobot_execution_contexts(user_id, expires_at);

create index if not exists lia_nanobot_execution_contexts_session_idx
  on public.lia_nanobot_execution_contexts(session_id, expires_at);

alter table public.lia_nanobot_execution_contexts enable row level security;

revoke all on public.lia_nanobot_execution_contexts from anon, authenticated;

comment on table public.lia_nanobot_execution_contexts is
  'Short-lived server-issued NEXORA identity bridge contexts for delegated Nanobot execution. Tokens are hashed at rest and validated server-side.';
