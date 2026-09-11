create table if not exists public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  status text not null default 'pending' check (status in ('pending','active','needs_reauth','error','revoked','disconnected')),
  institution_name text,
  institution_logo_url text,
  external_connection_id text,
  last_synced_at timestamptz,
  next_sync_at timestamptz,
  error_code text,
  error_message text,
  consent_expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, external_connection_id)
);

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.bank_connections(id) on delete cascade,
  provider text not null,
  external_account_id text not null,
  name text not null,
  account_type text not null default 'other' check (account_type in ('checking','savings','card','investment','loan','other')),
  iban_masked text,
  currency text not null default 'EUR',
  balance numeric(14,2),
  available_balance numeric(14,2),
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, external_account_id)
);

create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.bank_accounts(id) on delete cascade,
  connection_id uuid not null references public.bank_connections(id) on delete cascade,
  provider text not null,
  external_transaction_id text not null,
  booked_at date not null,
  value_date date,
  description text not null,
  merchant_name text,
  amount numeric(14,2) not null,
  currency text not null default 'EUR',
  category text,
  category_confidence numeric(5,4),
  pending boolean not null default false,
  raw_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, external_transaction_id)
);

create index if not exists bank_connections_user_idx on public.bank_connections(user_id, created_at desc);
create index if not exists bank_accounts_user_idx on public.bank_accounts(user_id, created_at desc);
create index if not exists bank_accounts_connection_idx on public.bank_accounts(connection_id);
create index if not exists bank_transactions_user_date_idx on public.bank_transactions(user_id, booked_at desc);
create index if not exists bank_transactions_account_date_idx on public.bank_transactions(account_id, booked_at desc);

alter table public.bank_connections enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.bank_transactions enable row level security;

create policy "bank connections own select" on public.bank_connections
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "bank connections own insert" on public.bank_connections
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "bank connections own update" on public.bank_connections
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "bank connections own delete" on public.bank_connections
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "bank accounts own select" on public.bank_accounts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "bank accounts own insert" on public.bank_accounts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "bank accounts own update" on public.bank_accounts
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "bank accounts own delete" on public.bank_accounts
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "bank transactions own select" on public.bank_transactions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "bank transactions own insert" on public.bank_transactions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "bank transactions own update" on public.bank_transactions
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "bank transactions own delete" on public.bank_transactions
  for delete to authenticated using ((select auth.uid()) = user_id);
