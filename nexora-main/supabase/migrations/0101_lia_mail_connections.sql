-- V5.08.36: Gmail + Outlook connection metadata. Tokens are deliberately not stored here.
create table if not exists public.lia_mail_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('gmail','outlook')),
  email text,
  status text not null default 'not_configured' check (status in ('not_configured','connected','error','revoked')),
  scopes text[] not null default '{}',
  last_sync_at timestamptz,
  connected_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique(user_id, provider)
);
alter table public.lia_mail_connections enable row level security;
drop policy if exists lia_mail_connections_select_own on public.lia_mail_connections;
create policy lia_mail_connections_select_own on public.lia_mail_connections for select using (auth.uid() = user_id);
-- Writes happen through server-side OAuth/sync services; no client insert/update/delete policy is granted.
