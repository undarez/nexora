create or replace function public.refresh_financial_notifications(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  month_start date := date_trunc('month', current_date)::date;
  next_month date := (date_trunc('month', current_date) + interval '1 month')::date;
  scenario jsonb;
  safety numeric := 0;
  budget_income numeric := 0;
  planned numeric := 0;
  spent numeric := 0;
  balance numeric := 0;
  actual_income numeric := 0;
  actual_expense numeric := 0;
  net numeric := 0;
  elapsed numeric := greatest(least(extract(day from current_date) / extract(day from (date_trunc('month', current_date) + interval '1 month - 1 day')), 1), 0);
  inserted_count integer := 0;
begin
  if uid is null or uid <> p_user_id then
    raise exception 'notification_refresh_forbidden' using errcode = '42501';
  end if;

  select bs.envelopes, bs.safety_reserve, bs.income
    into scenario, safety, budget_income
  from public.budget_scenarios as bs
  where bs.user_id = uid and bs.period_start = month_start
  limit 1;

  select coalesce(sum(a.balance),0)
    into balance
  from public.accounts as a
  where a.user_id = uid;

  select coalesce(sum(t.amount) filter (where t.amount > 0),0),
         coalesce(sum(abs(t.amount)) filter (where t.amount < 0),0)
    into actual_income, actual_expense
  from public.transactions as t
  where t.user_id = uid and t.occurred_at >= month_start and t.occurred_at < next_month;
  net := actual_income - actual_expense;

  if scenario is not null then
    select coalesce(sum(greatest(coalesce((value->>'planned')::numeric,0),0)),0),
           coalesce(sum(greatest(coalesce((value->>'spent')::numeric,0),0)),0)
      into planned, spent
    from jsonb_array_elements(
      case when jsonb_typeof(scenario->'envelopes') = 'array'
           then scenario->'envelopes'
           else '[]'::jsonb
      end
    );
  end if;

  if net > 0 and balance > safety and net >= 50 then
    insert into public.notifications(user_id, type, severity, title, message, action_href, dedupe_key)
    values (uid, 'saving_opportunity', 'success', 'Il est temps d’épargner',
      format('Ton mois est actuellement positif de %s €. Une partie peut être mise de côté tout en gardant ta réserve de sécurité.', to_char(net, 'FM999999990D00')),
      '/previsions', 'saving:' || month_start::text)
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    if found then inserted_count := inserted_count + 1; end if;
  end if;

  if planned > 0 and elapsed > 0 and spent / planned - elapsed >= 0.15 then
    insert into public.notifications(user_id, type, severity, title, message, action_href, dedupe_key)
    values (uid, 'budget_alert', case when spent / planned - elapsed >= 0.30 then 'danger' else 'warning' end,
      'Budget à surveiller',
      format('%s %% du budget des enveloppes est consommé pour environ %s %% du mois écoulé.', round((spent/planned)*100), round(elapsed*100)),
      '/budget', 'pace:' || month_start::text)
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    if found then inserted_count := inserted_count + 1; end if;
  end if;

  if net < 0 then
    insert into public.notifications(user_id, type, severity, title, message, action_href, dedupe_key)
    values (uid, 'forecast_alert', 'warning', 'Mois actuellement déficitaire',
      format('Les dépenses dépassent les revenus de %s € sur le mois en cours.', to_char(abs(net), 'FM999999990D00')),
      '/previsions', 'negative:' || month_start::text)
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    if found then inserted_count := inserted_count + 1; end if;
  end if;

  return inserted_count;
end;
$$;
