-- NEXORA V5.08.8 — Unified financial cross-domain layer.
-- Links imported bank transactions to budget envelopes without rewriting the
-- existing legacy transactions model. Budget spend becomes the sum of both ledgers.

create table if not exists public.bank_transaction_envelope_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bank_transaction_id uuid not null references public.bank_transactions(id) on delete cascade,
  period_start date not null,
  envelope_key text not null,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique(user_id, bank_transaction_id)
);

create index if not exists bank_tx_envelope_links_user_period_idx
  on public.bank_transaction_envelope_links(user_id, period_start);

alter table public.bank_transaction_envelope_links enable row level security;

drop policy if exists "bank transaction envelope links own" on public.bank_transaction_envelope_links;
create policy "bank transaction envelope links own"
  on public.bank_transaction_envelope_links
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.enforce_bank_transaction_envelope_link_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tx_owner uuid;
  tx_date date;
  tx_amount numeric;
begin
  select t.user_id, t.booked_at, abs(t.amount)
    into tx_owner, tx_date, tx_amount
    from public.bank_transactions t
    where t.id = NEW.bank_transaction_id;

  if tx_owner is null or tx_owner <> NEW.user_id then
    raise exception 'bank_transaction_envelope_owner_mismatch' using errcode = '42501';
  end if;

  if tx_date <> NEW.period_start
     and date_trunc('month', tx_date)::date <> NEW.period_start then
    raise exception 'bank_transaction_envelope_period_mismatch' using errcode = '22023';
  end if;

  if tx_amount < NEW.amount then
    raise exception 'bank_transaction_envelope_amount_exceeds_transaction' using errcode = '22003';
  end if;

  if (select amount from public.bank_transactions where id = NEW.bank_transaction_id) >= 0 then
    raise exception 'bank_transaction_envelope_requires_expense' using errcode = '22023';
  end if;

  return NEW;
end;
$$;

revoke execute on function public.enforce_bank_transaction_envelope_link_integrity() from public, anon, authenticated;

drop trigger if exists bank_transaction_envelope_link_integrity on public.bank_transaction_envelope_links;
create trigger bank_transaction_envelope_link_integrity
before insert or update on public.bank_transaction_envelope_links
for each row execute procedure public.enforce_bank_transaction_envelope_link_integrity();

-- Extend the existing budget synchronization function so imported bank
-- transactions also contribute to observed envelope spend.
create or replace function public.sync_budget_envelope_spent(p_user_id uuid, p_period_start date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  scenario_id uuid;
  source_envelopes jsonb;
  rebuilt jsonb := '[]'::jsonb;
  e jsonb;
  allocated numeric;
  bank_allocated numeric;
  manual numeric;
begin
  select id, envelopes into scenario_id, source_envelopes
  from public.budget_scenarios
  where user_id = p_user_id and period_start = p_period_start
  for update;

  if scenario_id is null or jsonb_typeof(source_envelopes) <> 'array' then
    return;
  end if;

  for e in select value from jsonb_array_elements(source_envelopes) loop
    select coalesce(sum(l.amount), 0) into allocated
    from public.transaction_envelope_links l
    where l.user_id = p_user_id
      and l.period_start = p_period_start
      and l.envelope_key = coalesce(e->>'id', '');

    select coalesce(sum(l.amount), 0) into bank_allocated
    from public.bank_transaction_envelope_links l
    where l.user_id = p_user_id
      and l.period_start = p_period_start
      and l.envelope_key = coalesce(e->>'id', '');

    manual := greatest(coalesce(nullif(e->>'manual_spent','')::numeric, 0), 0);

    rebuilt := rebuilt || jsonb_build_array(
      jsonb_set(
        jsonb_set(e, '{manual_spent}', to_jsonb(round(manual, 2)), true),
        '{spent}', to_jsonb(round(allocated + bank_allocated + manual, 2)), true
      )
    );
  end loop;

  update public.budget_scenarios
  set envelopes = rebuilt
  where id = scenario_id;
end;
$$;

revoke execute on function public.sync_budget_envelope_spent(uuid, date) from public, anon, authenticated;

create or replace function public.sync_budget_from_bank_envelope_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() = 1 then
    perform public.sync_budget_envelope_spent(
      coalesce(NEW.user_id, OLD.user_id),
      coalesce(NEW.period_start, OLD.period_start)
    );
  end if;
  return coalesce(NEW, OLD);
end;
$$;

revoke execute on function public.sync_budget_from_bank_envelope_link() from public, anon, authenticated;

drop trigger if exists bank_transaction_envelope_link_budget_sync on public.bank_transaction_envelope_links;
create trigger bank_transaction_envelope_link_budget_sync
after insert or update or delete on public.bank_transaction_envelope_links
for each row execute procedure public.sync_budget_from_bank_envelope_link();

comment on table public.bank_transaction_envelope_links is
  'Bridge between imported bank transactions and budget envelopes; keeps the bank ledger and budget cross-domain without duplicating transactions.';
