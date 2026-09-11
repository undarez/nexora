-- NEXORA V5.11.01 — Runtime notification ambiguity fix.
-- Uses uniquely prefixed PL/pgSQL variables so PostgreSQL cannot confuse
-- function variables with table columns (notably budget_scenarios.income).
create or replace function public.refresh_financial_notifications(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_month_start date := date_trunc('month', current_date)::date;
  v_next_month date := (date_trunc('month', current_date) + interval '1 month')::date;
  v_scenario jsonb;
  v_safety numeric := 0;
  v_planned numeric := 0;
  v_spent numeric := 0;
  v_balance numeric := 0;
  v_actual_income numeric := 0;
  v_actual_expense numeric := 0;
  v_net numeric := 0;
  v_elapsed numeric := greatest(least(
    extract(day from current_date) /
    extract(day from (date_trunc('month', current_date) + interval '1 month - 1 day')),
    1
  ), 0);
  v_inserted_count integer := 0;
  v_connection record;
  v_days_left integer;
  v_reminder_key text;
begin
  if v_uid is null or v_uid <> p_user_id then
    raise exception 'notification_refresh_forbidden' using errcode='42501';
  end if;

  select bs.envelopes, bs.safety_reserve
    into v_scenario, v_safety
  from public.budget_scenarios as bs
  where bs.user_id=v_uid and bs.period_start=v_month_start
  limit 1;

  select coalesce(sum(a.balance),0)
    into v_balance
  from public.accounts as a
  where a.user_id=v_uid;

  select
    coalesce(sum(t.amount) filter (where t.amount > 0),0),
    coalesce(sum(abs(t.amount)) filter (where t.amount < 0),0)
    into v_actual_income, v_actual_expense
  from public.transactions as t
  where t.user_id=v_uid
    and t.occurred_at>=v_month_start
    and t.occurred_at<v_next_month;

  v_net := v_actual_income-v_actual_expense;

  if v_scenario is not null then
    select
      coalesce(sum(greatest(coalesce(e.value->>'planned','0')::numeric,0)),0),
      coalesce(sum(greatest(coalesce(e.value->>'spent','0')::numeric,0)),0)
      into v_planned,v_spent
    from jsonb_array_elements(
      case when jsonb_typeof(v_scenario->'envelopes')='array'
        then v_scenario->'envelopes' else '[]'::jsonb end
    ) as e(value);
  end if;

  for v_connection in
    select bc.id,bc.institution_name,bc.reconnect_due_at,bc.status
    from public.bank_connections as bc
    where bc.user_id=v_uid
      and bc.reconnect_due_at is not null
      and bc.status not in ('revoked','disconnected')
  loop
    v_days_left := ceil(extract(epoch from (v_connection.reconnect_due_at-now()))/86400.0)::integer;
    if v_days_left<=0 then
      update public.bank_connections as bc
      set status='needs_reauth',
          error_code='RECONNECT_90D_REQUIRED',
          error_message='La reconnexion bancaire est requise après 90 jours.',
          updated_at=now()
      where bc.id=v_connection.id and bc.user_id=v_uid and bc.status<>'revoked';

      v_reminder_key := 'bank-reconnect:'||v_connection.id::text||':expired';
      insert into public.notifications(user_id,type,severity,title,message,action_href,dedupe_key)
      values(v_uid,'bank_reconnect','danger','Reconnexion bancaire requise',
        format('%s doit être reconnectée pour continuer la synchronisation de tes données bancaires.',coalesce(v_connection.institution_name,'Ta banque')),
        '/banque',v_reminder_key)
      on conflict (user_id,dedupe_key) where dedupe_key is not null do nothing;
      if found then v_inserted_count:=v_inserted_count+1; end if;

    elsif v_days_left<=30 then
      v_reminder_key := 'bank-reconnect:'||v_connection.id::text||':'||
        case when v_days_left<=1 then '1' when v_days_left<=7 then '7'
             when v_days_left<=14 then '14' else '30' end;
      insert into public.notifications(user_id,type,severity,title,message,action_href,dedupe_key)
      values(v_uid,'bank_reconnect',case when v_days_left<=7 then 'warning' else 'info' end,
        'Reconnexion bancaire à prévoir',
        format('%s devra être reconnectée dans %s jour%s. NEXORA te le rappelle pour éviter une interruption de synchronisation.',
          coalesce(v_connection.institution_name,'Ta banque'),v_days_left,
          case when v_days_left=1 then '' else 's' end),
        '/banque',v_reminder_key)
      on conflict (user_id,dedupe_key) where dedupe_key is not null do nothing;
      if found then v_inserted_count:=v_inserted_count+1; end if;
    end if;
  end loop;

  if v_net>0 and v_balance>v_safety and v_net>=50 then
    insert into public.notifications(user_id,type,severity,title,message,action_href,dedupe_key)
    values(v_uid,'saving_opportunity','success','Il est temps d’épargner',
      format('Ton mois est actuellement positif de %s €. Une partie peut être mise de côté tout en gardant ta réserve de sécurité.',to_char(v_net,'FM999999990D00')),
      '/previsions','saving:'||v_month_start::text)
    on conflict (user_id,dedupe_key) where dedupe_key is not null do nothing;
    if found then v_inserted_count:=v_inserted_count+1; end if;
  end if;

  if v_planned>0 and v_elapsed>0 and v_spent/v_planned-v_elapsed>=0.15 then
    insert into public.notifications(user_id,type,severity,title,message,action_href,dedupe_key)
    values(v_uid,'budget_alert',case when v_spent/v_planned-v_elapsed>=0.30 then 'danger' else 'warning' end,
      'Budget à surveiller',
      format('%s %% du budget des enveloppes est consommé pour environ %s %% du mois écoulé.',round((v_spent/v_planned)*100),round(v_elapsed*100)),
      '/budget','pace:'||v_month_start::text)
    on conflict (user_id,dedupe_key) where dedupe_key is not null do nothing;
    if found then v_inserted_count:=v_inserted_count+1; end if;
  end if;

  if v_net<0 then
    insert into public.notifications(user_id,type,severity,title,message,action_href,dedupe_key)
    values(v_uid,'forecast_alert','warning','Mois actuellement déficitaire',
      format('Les dépenses dépassent les revenus de %s € sur le mois en cours.',to_char(abs(v_net),'FM999999990D00')),
      '/previsions','negative:'||v_month_start::text)
    on conflict (user_id,dedupe_key) where dedupe_key is not null do nothing;
    if found then v_inserted_count:=v_inserted_count+1; end if;
  end if;

  return v_inserted_count;
end;
$$;

revoke execute on function public.refresh_financial_notifications(uuid) from public,anon;
grant execute on function public.refresh_financial_notifications(uuid) to authenticated;
