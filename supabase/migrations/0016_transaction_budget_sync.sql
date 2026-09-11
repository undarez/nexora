-- Gérer Finance v4.30 — Transaction → enveloppe → budget synchronization.
-- The database is the source of truth for allocated spend. Manual envelope
-- adjustments are preserved separately in each envelope JSON object.

-- Backfill a stable manual_spent component before enabling synchronization.
do $$
declare
  r record;
  e jsonb;
  alloc numeric;
  manual numeric;
  rebuilt jsonb;
begin
  if to_regclass('public.budget_scenarios') is null then
    return;
  end if;

  for r in select id, user_id, period_start, envelopes from public.budget_scenarios loop
    rebuilt := '[]'::jsonb;
    if jsonb_typeof(r.envelopes) <> 'array' then
      continue;
    end if;

    for e in select value from jsonb_array_elements(r.envelopes) loop
      select coalesce(sum(l.amount), 0) into alloc
      from public.transaction_envelope_links l
      where l.user_id = r.user_id
        and l.period_start = r.period_start
        and l.envelope_key = coalesce(e->>'id', '');

      manual := greatest(coalesce(nullif(e->>'manual_spent','')::numeric, 0), coalesce(nullif(e->>'spent','')::numeric, 0) - alloc, 0);
      rebuilt := rebuilt || jsonb_build_array(
        jsonb_set(
          jsonb_set(e, '{manual_spent}', to_jsonb(round(manual, 2)), true),
          '{spent}', to_jsonb(round(alloc + manual, 2)), true
        )
      );
    end loop;

    update public.budget_scenarios
    set envelopes = rebuilt
    where id = r.id;
  end loop;
end $$;

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

    manual := greatest(coalesce(nullif(e->>'manual_spent','')::numeric, 0), 0);
    rebuilt := rebuilt || jsonb_build_array(
      jsonb_set(
        jsonb_set(e, '{manual_spent}', to_jsonb(round(manual, 2)), true),
        '{spent}', to_jsonb(round(allocated + manual, 2)), true
      )
    );
  end loop;

  update public.budget_scenarios
  set envelopes = rebuilt
  where id = scenario_id;
end;
$$;

revoke execute on function public.sync_budget_envelope_spent(uuid, date) from public, anon, authenticated;

create or replace function public.sync_budget_from_envelope_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() = 1 then
    perform public.sync_budget_envelope_spent(coalesce(NEW.user_id, OLD.user_id), coalesce(NEW.period_start, OLD.period_start));
  end if;
  return coalesce(NEW, OLD);
end;
$$;
revoke execute on function public.sync_budget_from_envelope_link() from public, anon, authenticated;

drop trigger if exists transaction_envelope_link_budget_sync on public.transaction_envelope_links;
create trigger transaction_envelope_link_budget_sync
after insert or update or delete on public.transaction_envelope_links
for each row execute procedure public.sync_budget_from_envelope_link();

-- Whenever a budget scenario is created/edited, recalculate observed spend from
-- transaction allocations. pg_trigger_depth prevents recursion from the sync update.
create or replace function public.sync_budget_from_scenario_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() = 1 then
    perform public.sync_budget_envelope_spent(NEW.user_id, NEW.period_start);
  end if;
  return NEW;
end;
$$;
revoke execute on function public.sync_budget_from_scenario_change() from public, anon, authenticated;

drop trigger if exists budget_scenario_spend_sync on public.budget_scenarios;
create trigger budget_scenario_spend_sync
after insert or update of envelopes on public.budget_scenarios
for each row execute procedure public.sync_budget_from_scenario_change();

-- Prevent edits that would leave an existing allocation invalid. The user must
-- remove/reassign the envelope link before changing the transaction's month or
-- reducing its absolute amount below the allocated amount.
create or replace function public.enforce_transaction_allocation_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare allocated numeric;
begin
  select coalesce(sum(amount), 0) into allocated
  from public.transaction_envelope_links
  where transaction_id = OLD.id;

  if allocated > 0 and (
    date_trunc('month', NEW.occurred_at)::date <> date_trunc('month', OLD.occurred_at)::date
    or abs(NEW.amount) < allocated
    or NEW.amount >= 0
  ) then
    raise exception 'transaction_has_envelope_allocation_remove_or_reassign_first' using errcode = '22023';
  end if;

  return NEW;
end;
$$;
revoke execute on function public.enforce_transaction_allocation_update() from public, anon, authenticated;

drop trigger if exists transaction_allocation_update_guard on public.transactions;
create trigger transaction_allocation_update_guard
before update on public.transactions
for each row execute procedure public.enforce_transaction_allocation_update();

comment on function public.sync_budget_envelope_spent(uuid, date) is
  'Recomputes envelope spent as transaction allocations plus an explicit manual adjustment.';
