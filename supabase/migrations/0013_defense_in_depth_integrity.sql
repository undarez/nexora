-- Gérer Finance v4.23 — Defense-in-depth data integrity.
-- Goal: prevent authenticated clients from creating cross-user relationships
-- even when a row-level policy on the immediate table is otherwise correct.

-- Internal/system-owned tables: no client Data API access.
do $$
declare t text;
begin
  foreach t in array ARRAY['rules','rule_versions','knowledge_sources','knowledge_items']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- Shared trigger helper. SECURITY DEFINER is intentional because ownership
-- checks must inspect another user's row despite that table's RLS policies.
create or replace function public.enforce_financial_ownership_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
begin
  if TG_TABLE_NAME = 'transactions' then
    select a.user_id into owner_id from public.accounts a where a.id = NEW.account_id;
    if owner_id is null or owner_id <> NEW.user_id then
      raise exception 'transaction_account_owner_mismatch' using errcode = '42501';
    end if;

    if NEW.category_id is not null then
      select c.user_id into owner_id from public.categories c where c.id = NEW.category_id;
      if owner_id is not null and owner_id <> NEW.user_id then
        raise exception 'transaction_category_owner_mismatch' using errcode = '42501';
      end if;
    end if;

  elsif TG_TABLE_NAME = 'budget_lines' then
    select b.user_id into owner_id from public.budgets b where b.id = NEW.budget_id;
    if owner_id is null then
      raise exception 'budget_owner_missing' using errcode = '42501';
    end if;
    if NEW.category_id is not null then
      declare category_owner uuid;
      begin
        select c.user_id into category_owner from public.categories c where c.id = NEW.category_id;
        if category_owner is not null and category_owner <> owner_id then
          raise exception 'budget_category_owner_mismatch' using errcode = '42501';
        end if;
      end;
    end if;

  elsif TG_TABLE_NAME = 'bank_accounts' then
    select c.user_id into owner_id from public.bank_connections c where c.id = NEW.connection_id;
    if owner_id is null or owner_id <> NEW.user_id then
      raise exception 'bank_account_connection_owner_mismatch' using errcode = '42501';
    end if;

  elsif TG_TABLE_NAME = 'bank_transactions' then
    declare account_owner uuid; connection_owner uuid; account_connection uuid;
    begin
      select a.user_id, a.connection_id into account_owner, account_connection
        from public.bank_accounts a where a.id = NEW.account_id;
      select c.user_id into connection_owner
        from public.bank_connections c where c.id = NEW.connection_id;
      if account_owner is null or account_owner <> NEW.user_id
         or connection_owner is null or connection_owner <> NEW.user_id
         or account_connection <> NEW.connection_id then
        raise exception 'bank_transaction_owner_mismatch' using errcode = '42501';
      end if;
    end;

  elsif TG_TABLE_NAME = 'bank_consent_events' then
    if NEW.connection_id is not null then
      select c.user_id into owner_id from public.bank_connections c where c.id = NEW.connection_id;
      if owner_id is null or owner_id <> NEW.user_id then
        raise exception 'bank_consent_connection_owner_mismatch' using errcode = '42501';
      end if;
    end if;
  end if;

  return NEW;
end;
$$;

revoke execute on function public.enforce_financial_ownership_integrity() from public, anon, authenticated;

drop trigger if exists transactions_ownership_integrity on public.transactions;
create trigger transactions_ownership_integrity
before insert or update on public.transactions
for each row execute procedure public.enforce_financial_ownership_integrity();

drop trigger if exists budget_lines_ownership_integrity on public.budget_lines;
create trigger budget_lines_ownership_integrity
before insert or update on public.budget_lines
for each row execute procedure public.enforce_financial_ownership_integrity();

drop trigger if exists bank_accounts_ownership_integrity on public.bank_accounts;
create trigger bank_accounts_ownership_integrity
before insert or update on public.bank_accounts
for each row execute procedure public.enforce_financial_ownership_integrity();

drop trigger if exists bank_transactions_ownership_integrity on public.bank_transactions;
create trigger bank_transactions_ownership_integrity
before insert or update on public.bank_transactions
for each row execute procedure public.enforce_financial_ownership_integrity();

drop trigger if exists bank_consent_events_ownership_integrity on public.bank_consent_events;
create trigger bank_consent_events_ownership_integrity
before insert or update on public.bank_consent_events
for each row execute procedure public.enforce_financial_ownership_integrity();

-- Defensive indexes for the ownership checks and common tenant-scoped access paths.
create index if not exists budget_lines_budget_category_idx on public.budget_lines(budget_id, category_id);
create index if not exists bank_transactions_connection_account_idx on public.bank_transactions(connection_id, account_id);

comment on function public.enforce_financial_ownership_integrity() is
  'Defense-in-depth: rejects cross-user relationships between financial rows. Client roles cannot execute directly.';

-- budget_lines has no user_id of its own; authorization follows its parent budget.
drop policy if exists "budget lines own" on public.budget_lines;
create policy "budget lines own" on public.budget_lines
  for all to authenticated
  using (exists (select 1 from public.budgets b where b.id = budget_id and b.user_id = (select auth.uid())))
  with check (exists (select 1 from public.budgets b where b.id = budget_id and b.user_id = (select auth.uid())));
