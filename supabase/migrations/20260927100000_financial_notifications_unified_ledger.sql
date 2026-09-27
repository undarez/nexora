-- NEXORA — align financial notifications with the unified financial context.
-- Notifications must not silently ignore active Open Banking liquidity and transactions.
-- Manual and bank ledgers remain separate sources; reconciliation/deduplication is
-- handled by the unified financial layer rather than this notification refresher.

create or replace function public.refresh_financial_notifications(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  month_start date := date_trunc('month', current_date)::date;
  next_month date := (date_trunc('month', current_date) + interval '1 month')::date;
  scenario jsonb;
  safety numeric := 0;
  income numeric := 0;
  planned numeric := 0;
  spent numeric := 0;
  balance numeric := 0;
  actual_income numeric := 0;
  actual_expense numeric := 0;
  net numeric := 0;
  elapsed numeric := greatest(least(
    extract(day from current_date) /
      extract(day from (date_trunc('month', current_date) + interval '1 month - 1 day')),
    1
  ), 0);
  inserted_count integer := 0;
  connection_row record;
  days_left integer;
  reminder_key text;
begin
  if uid is null or uid <> p_user_id then
    raise exception 'notification_refresh_forbidden' using errcode = '42501';
  end if;

  select envelopes, safety_reserve, income
    into scenario, safety, income
  from public.budget_scenarios
  where user_id = uid
    and period_start = month_start
  limit 1;

  -- Match the unified financial context: manual liquidity + active bank liquidity.
  select
    coalesce((select sum(a.balance) from public.accounts a where a.user_id = uid), 0)
    +
    coalesce((select sum(ba.balance)
              from public.bank_accounts ba
              where ba.user_id = uid and ba.status = 'active'), 0)
    into balance;

  -- Match the unified financial context: both ledgers contribute to observed
  -- monthly cashflow. The ledgers are intentionally not merged here because
  -- reconciliation policy belongs to the unified financial layer.
  select
    coalesce(sum(amount) filter (where amount > 0), 0),
    coalesce(sum(abs(amount)) filter (where amount < 0), 0)
    into actual_income, actual_expense
  from (
    select t.amount
    from public.transactions t
    where t.user_id = uid
      and t.occurred_at >= month_start
      and t.occurred_at < next_month
    union all
    select bt.amount
    from public.bank_transactions bt
    where bt.user_id = uid
      and bt.booked_at >= month_start
      and bt.booked_at < next_month
  ) ledger;

  net := actual_income - actual_expense;

  if scenario is not null then
    select
      coalesce(sum(greatest(coalesce((value->>'planned')::numeric, 0), 0)), 0),
      coalesce(sum(greatest(coalesce((value->>'spent')::numeric, 0), 0)), 0)
      into planned, spent
    from jsonb_array_elements(
      case
        when jsonb_typeof(scenario->'envelopes') = 'array'
        then scenario->'envelopes'
        else '[]'::jsonb
      end
    );
  end if;

  -- 90-day Open Banking reminders.
  for connection_row in
    select id, institution_name, reconnect_due_at, status
    from public.bank_connections
    where user_id = uid
      and reconnect_due_at is not null
      and status not in ('revoked', 'disconnected')
  loop
    days_left := ceil(
      extract(epoch from (connection_row.reconnect_due_at - now())) / 86400.0
    )::integer;

    if days_left <= 0 then
      update public.bank_connections
      set status = 'needs_reauth',
          error_code = 'RECONNECT_90D_REQUIRED',
          error_message = 'La reconnexion bancaire est requise après 90 jours.',
          updated_at = now()
      where id = connection_row.id
        and user_id = uid
        and status <> 'revoked';

      reminder_key := 'bank-reconnect:' || connection_row.id::text || ':expired';

      insert into public.notifications(
        user_id, type, severity, title, message, action_href, dedupe_key
      )
      values (
        uid,
        'bank_reconnect',
        'danger',
        'Reconnexion bancaire requise',
        format(
          '%s doit être reconnectée pour continuer la synchronisation de tes données bancaires.',
          coalesce(connection_row.institution_name, 'Ta banque')
        ),
        '/banque',
        '/reconnect:' || connection_row.id::text || ':expired'
      )
      on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

      inserted_count := inserted_count + 1;
    elsif days_left <= 1 or days_left <= 7 or days_left <= 14 or days_left <= 30 then
      reminder_key := 'bank-reconnect:' || connection_row.id::text || ':' ||
        case
          when days_left <= 1 then '1'
          when days_left <= 7 then '7'
          when days_left <= 14 then '14'
          else '30'
        end;

      insert into public.notifications(
        user_id, type, severity, title, message, action_href, dedupe_key
      )
      values (
        uid,
        'bank_reconnect',
        case when days_left <= 7 then 'warning' else 'info' end,
        'Reconnexion bancaire à prévoir',
        format(
          '%s devra être reconnectée dans %s jour%s. NEXORA te le rappelle pour éviter une interruption de synchronisation.',
          coalesce(connection_row.institution_name, 'Ta banque'),
          days_left,
          case when days_left = 1 then '' else 's' end
        ),
        '/banque',
        reminder_key
      )
      on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

      inserted_count := inserted_count + 1;
    end if;
  end loop;

  if net > 0 and balance > safety and net >= 50 then
    insert into public.notifications(
      user_id, type, severity, title, message, action_href, dedupe_key
    )
    values (
      uid,
      'saving_opportunity',
      'success',
      'Il est temps d’épargner',
      format(
        'Ton mois est actuellement positif de %s €. Une partie peut être mise de côté tout en gardant ta réserve de sécurité.',
        to_char(net, 'FM999999990D00')
      ),
      '/previsions',
      'saving:' || month_start::text
    )
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

    inserted_count := inserted_count + 1;
  end if;

  if planned > 0 and elapsed > 0 and spent / planned - elapsed >= 0.15 then
    insert into public.notifications(
      user_id, type, severity, title, message, action_href, dedupe_key
    )
    values (
      uid,
      'budget_alert',
      case when spent / planned - elapsed >= 0.30 then 'danger' else 'warning' end,
      'Budget à surveiller',
      format(
        '%s %% du budget des enveloppes est consommé pour environ %s %% du mois écoulé.',
        round((spent / planned) * 100),
        round(elapsed * 100)
      ),
      '/budget',
      'pace:' || month_start::text
    )
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

    inserted_count := inserted_count + 1;
  end if;

  if net < 0 then
    insert into public.notifications(
      user_id, type, severity, title, message, action_href, dedupe_key
    )
    values (
      uid,
      'forecast_alert',
      'warning',
      'Mois actuellement déficitaire',
      format(
        'Les dépenses dépassent les revenus de %s € sur le mois en cours.',
        to_char(abs(net), 'FM999999990D00')
      ),
      '/previsions',
      'negative:' || month_start::text
    )
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

    inserted_count := inserted_count + 1;
  end if;

  return inserted_count;
end;
$$;

revoke execute on function public.refresh_financial_notifications(uuid) from public, anon;
grant execute on function public.refresh_financial_notifications(uuid) to authenticated;
