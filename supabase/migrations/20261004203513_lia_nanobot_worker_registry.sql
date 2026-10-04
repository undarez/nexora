create table if not exists public.lia_nanobot_workers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id text not null,
  organization_id text not null,
  credential_id uuid not null unique references public.lia_nanobot_runtime_credentials(id) on delete restrict,
  worker_key text not null unique,
  environment text not null default 'production' check (environment in ('development','staging','production')),
  status text not null default 'provisioning' check (status in ('provisioning','ready','draining','disabled','error')),
  desired_state text not null default 'running' check (desired_state in ('running','stopped')),
  endpoint_url text,
  workspace_ref text not null,
  config_ref text not null,
  session_namespace text not null,
  restrict_to_workspace boolean not null default true,
  max_concurrency integer not null default 2 check (max_concurrency between 1 and 32),
  request_timeout_ms integer not null default 120000 check (request_timeout_ms between 5000 and 300000),
  last_heartbeat_at timestamptz,
  last_started_at timestamptz,
  failure_count integer not null default 0 check (failure_count >= 0),
  last_error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, agent_id, organization_id)
);

create index if not exists lia_nanobot_workers_user_status_idx on public.lia_nanobot_workers(user_id, status, desired_state);
create index if not exists lia_nanobot_workers_heartbeat_idx on public.lia_nanobot_workers(last_heartbeat_at);
alter table public.lia_nanobot_workers enable row level security;
revoke all on public.lia_nanobot_workers from anon, authenticated;
comment on table public.lia_nanobot_workers is 'NEXORA registry for isolated external Nanobot workers. Contains routing and health metadata, never worker secrets.';
comment on column public.lia_nanobot_workers.workspace_ref is 'Opaque worker-side workspace reference; must identify a user/tenant isolated workspace.';
comment on column public.lia_nanobot_workers.config_ref is 'Opaque worker-side config reference; must identify a user/tenant isolated Nanobot configuration.';
comment on column public.lia_nanobot_workers.credential_id is 'NEXORA runtime credential bound to this worker. The plaintext credential is never stored here.';
