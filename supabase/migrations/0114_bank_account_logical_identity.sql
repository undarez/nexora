-- A logical bank account is identified by provider + masked IBAN + currency.
-- Duplicate rows are retained as disabled records so no historical data is deleted.
do $$
declare
  grp record;
  keep_id uuid;
  duplicate_id uuid;
begin
  for grp in
    select user_id, provider, iban_masked, currency
    from public.bank_accounts
    where iban_masked is not null
    group by user_id, provider, iban_masked, currency
    having count(*) > 1
  loop
    select id into keep_id
    from public.bank_accounts
    where user_id = grp.user_id
      and provider = grp.provider
      and iban_masked = grp.iban_masked
      and currency = grp.currency
    order by case when status = 'active' then 0 else 1 end, updated_at desc nulls last, created_at asc
    limit 1;

    for duplicate_id in
      select id
      from public.bank_accounts
      where user_id = grp.user_id
        and provider = grp.provider
        and iban_masked = grp.iban_masked
        and currency = grp.currency
        and id <> keep_id
    loop
      update public.bank_accounts
      set status = 'disabled', updated_at = now()
      where id = duplicate_id;
    end loop;
  end loop;
end $$;

create unique index if not exists bank_accounts_logical_identity_uidx
  on public.bank_accounts (user_id, provider, iban_masked, currency)
  where iban_masked is not null and status = 'active';

create index if not exists bank_accounts_logical_identity_lookup_idx
  on public.bank_accounts (user_id, provider, iban_masked, currency)
  where iban_masked is not null;
