-- Admin connection telemetry: one row per authenticated user session.
-- IP is collected only for the server-side admin security view; no geolocation is derived.
create table if not exists public.user_connection_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  ip_address inet,
  user_agent text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, session_id)
);

create index if not exists idx_user_connection_events_user_last_seen
  on public.user_connection_events(user_id, last_seen_at desc);
create index if not exists idx_user_connection_events_last_seen
  on public.user_connection_events(last_seen_at desc);

alter table public.user_connection_events enable row level security;
revoke all on public.user_connection_events from anon, authenticated;

comment on table public.user_connection_events is
  'Admin-only authenticated session telemetry. Technical connection metadata only.';
comment on column public.user_connection_events.ip_address is
  'Technical source IP captured server-side for admin security and operations only.';

create or replace function public.cleanup_old_user_connection_events(p_before timestamptz)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare deleted_count integer;
begin
  delete from public.user_connection_events where last_seen_at < p_before;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
revoke execute on function public.cleanup_old_user_connection_events(timestamptz) from public, anon, authenticated;
