-- NEXORA V5.08.12 — Explicit Open Banking account access revocation.
alter table public.bank_accounts
  add column if not exists status text not null default 'active',
  add column if not exists access_revoked_at timestamptz;

alter table public.bank_accounts
  drop constraint if exists bank_accounts_status_check;
alter table public.bank_accounts
  add constraint bank_accounts_status_check check (status in ('active','disabled','revoked'));

create index if not exists bank_accounts_connection_status_idx
  on public.bank_accounts(connection_id, status);

comment on column public.bank_accounts.status is
  'Local access state. disabled means the user withdrew this account from Open Banking synchronization; revoked means the remote connection was deleted/revoked.';
comment on column public.bank_accounts.access_revoked_at is
  'Timestamp when Open Banking access to this account was explicitly withdrawn or its connection was revoked.';
