create table if not exists public.bank_sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.bank_connections(id) on delete cascade,
  provider text not null,
  status text not null check (status in ('started','completed','failed','skipped')),
  accounts_upserted integer not null default 0,
  transactions_upserted integer not null default 0,
  skipped_count integer not null default 0,
  reason text,
  error_code text,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists bank_sync_runs_connection_idx on public.bank_sync_runs(connection_id, created_at desc);
create index if not exists bank_sync_runs_user_idx on public.bank_sync_runs(user_id, created_at desc);
alter table public.bank_sync_runs enable row level security;
drop policy if exists "bank sync runs own select" on public.bank_sync_runs;
create policy "bank sync runs own select" on public.bank_sync_runs for select to authenticated using ((select auth.uid()) = user_id);
