-- Gérer Finance v4.29 — Transaction central engine.
-- Adds explicit envelope allocation metadata without changing transaction ownership rules.
create table if not exists public.transaction_envelope_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  period_start date not null,
  envelope_key text not null,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique(user_id, transaction_id)
);

create index if not exists transaction_envelope_links_user_period_idx
  on public.transaction_envelope_links(user_id, period_start);

alter table public.transaction_envelope_links enable row level security;
drop policy if exists "transaction envelope links own" on public.transaction_envelope_links;
create policy "transaction envelope links own" on public.transaction_envelope_links
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.enforce_transaction_envelope_link_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare tx_owner uuid; tx_date date; tx_amount numeric;
begin
  select t.user_id, t.occurred_at::date, abs(t.amount)
    into tx_owner, tx_date, tx_amount
    from public.transactions t where t.id = NEW.transaction_id;
  if tx_owner is null or tx_owner <> NEW.user_id then
    raise exception 'transaction_envelope_owner_mismatch' using errcode = '42501';
  end if;
  if NEW.period_start <> date_trunc('month', tx_date)::date then
    raise exception 'transaction_envelope_period_mismatch' using errcode = '22023';
  end if;
  if NEW.amount > tx_amount then
    raise exception 'transaction_envelope_amount_exceeds_transaction' using errcode = '22003';
  end if;
  return NEW;
end;
$$;
revoke execute on function public.enforce_transaction_envelope_link_integrity() from public, anon, authenticated;
drop trigger if exists transaction_envelope_link_integrity on public.transaction_envelope_links;
create trigger transaction_envelope_link_integrity
before insert or update on public.transaction_envelope_links
for each row execute procedure public.enforce_transaction_envelope_link_integrity();
