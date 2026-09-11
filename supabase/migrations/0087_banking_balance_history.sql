create table if not exists public.bank_balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.bank_accounts(id) on delete cascade,
  balance numeric(14,2) not null,
  available_balance numeric(14,2),
  currency text not null default 'EUR',
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists bank_balance_snapshots_account_date_idx
  on public.bank_balance_snapshots(account_id, captured_at desc);
create index if not exists bank_balance_snapshots_user_date_idx
  on public.bank_balance_snapshots(user_id, captured_at desc);

alter table public.bank_balance_snapshots enable row level security;
drop policy if exists "bank balance snapshots own select" on public.bank_balance_snapshots;
create policy "bank balance snapshots own select" on public.bank_balance_snapshots
  for select to authenticated using ((select auth.uid()) = user_id);
