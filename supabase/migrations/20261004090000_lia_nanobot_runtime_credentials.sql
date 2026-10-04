create table if not exists public.lia_nanobot_runtime_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id text not null,
  organization_id text not null,
  credential_hash text not null unique,
  label text not null default 'NEXORA Nanobot runtime',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists lia_nanobot_runtime_credentials_user_idx
  on public.lia_nanobot_runtime_credentials(user_id, revoked_at);

alter table public.lia_nanobot_runtime_credentials enable row level security;

revoke all on public.lia_nanobot_runtime_credentials from anon, authenticated;

comment on table public.lia_nanobot_runtime_credentials is
  'Per-user Nanobot runtime credentials. Plaintext credentials are never persisted; each credential is mapped to one NEXORA LIA principal and can be revoked.';
