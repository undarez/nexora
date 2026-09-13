-- NEXORA V5.08.25 — Schema reconciliation and runtime integrity.
-- Safe to run against an already partially migrated Supabase project.

-- 90-day Open Banking policy columns.
alter table public.bank_connections
  add column if not exists consent_granted_at timestamptz,
  add column if not exists reconnect_due_at timestamptz;

create index if not exists bank_connections_reconnect_due_idx
  on public.bank_connections(user_id, reconnect_due_at)
  where reconnect_due_at is not null and status not in ('revoked','disconnected');

-- Enterprise financial obligations used by the Enterprise cockpit.
create table if not exists public.business_financial_obligations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.financial_workspaces(id) on delete cascade,
  obligation_type text not null check (obligation_type in ('vat','tax','social','supplier','payroll','loan','other')),
  label text not null,
  due_date date not null,
  amount numeric(14,2) not null default 0 check (amount >= 0),
  currency text not null default 'EUR',
  status text not null default 'planned' check (status in ('planned','paid','cancelled')),
  notes text,
  source text not null default 'manual' check (source in ('manual','imported','system')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_financial_obligations_workspace_due_idx
  on public.business_financial_obligations(workspace_id,due_date,status);

alter table public.business_financial_obligations enable row level security;

drop policy if exists business_financial_obligations_select_member on public.business_financial_obligations;
create policy business_financial_obligations_select_member
on public.business_financial_obligations for select to authenticated
using (exists (
  select 1 from public.financial_workspace_members m
  where m.workspace_id = business_financial_obligations.workspace_id
    and m.user_id = auth.uid()
    and m.status = 'active'
));

drop policy if exists business_financial_obligations_insert_member on public.business_financial_obligations;
create policy business_financial_obligations_insert_member
on public.business_financial_obligations for insert to authenticated
with check (exists (
  select 1 from public.financial_workspace_members m
  where m.workspace_id = business_financial_obligations.workspace_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and m.role in ('owner','admin')
));

drop policy if exists business_financial_obligations_update_member on public.business_financial_obligations;
create policy business_financial_obligations_update_member
on public.business_financial_obligations for update to authenticated
using (exists (
  select 1 from public.financial_workspace_members m
  where m.workspace_id = business_financial_obligations.workspace_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and m.role in ('owner','admin')
))
with check (exists (
  select 1 from public.financial_workspace_members m
  where m.workspace_id = business_financial_obligations.workspace_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and m.role in ('owner','admin')
));

-- Replace the 0092 function with the ambiguity-free implementation.
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

  select bs.envelopes, bs.safety_reserve
    into scenario, safety
  from public.budget_scenarios as bs
  where bs.user_id = uid
    and bs.period_start = month_start
  limit 1;

  select coalesce(sum(a.balance), 0)
    into balance
  from public.accounts as a
  where a.user_id = uid;

  select
    coalesce(sum(t.amount) filter (where t.amount > 0), 0),
    coalesce(sum(abs(t.amount)) filter (where t.amount < 0), 0)
    into actual_income, actual_expense
  from public.transactions as t
  where t.user_id = uid
    and t.occurred_at >= month_start
    and t.occurred_at < next_month;

  net := actual_income - actual_expense;

  if scenario is not null then
    select
      coalesce(sum(greatest(coalesce(e.value->>'planned','0')::numeric,0)),0),
      coalesce(sum(greatest(coalesce(e.value->>'spent','0')::numeric,0)),0)
      into planned, spent
    from jsonb_array_elements(
      case
        when jsonb_typeof(scenario->'envelopes') = 'array' then scenario->'envelopes'
        else '[]'::jsonb
      end
    ) as e(value);
  end if;

  -- 90-day Open Banking reminders.
  for connection_row in
    select bc.id, bc.institution_name, bc.reconnect_due_at, bc.status
    from public.bank_connections as bc
    where bc.user_id = uid
      and bc.reconnect_due_at is not null
      and bc.status not in ('revoked','disconnected')
  loop
    days_left := ceil(extract(epoch from (connection_row.reconnect_due_at - now())) / 86400.0)::integer;

    if days_left <= 0 then
      update public.bank_connections as bc
      set status = 'needs_reauth',
          error_code = 'RECONNECT_90D_REQUIRED',
          error_message = 'La reconnexion bancaire est requise après 90 jours.',
          updated_at = now()
      where bc.id = connection_row.id
        and bc.user_id = uid
        and bc.status <> 'revoked';

      reminder_key := 'bank-reconnect:' || connection_row.id::text || ':expired';
      insert into public.notifications(user_id,type,severity,title,message,action_href,dedupe_key)
      values (
        uid,'bank_reconnect','danger','Reconnexion bancaire requise',
        format('%s doit être reconnectée pour continuer la synchronisation de tes données bancaires.', coalesce(connection_row.institution_name,'Ta banque')),
        '/banque','/reconnect:' || connection_row.id::text || ':expired'
      )
      on conflict (user_id,dedupe_key) where dedupe_key is not null do nothing;
      if found then inserted_count := inserted_count + 1; end if;

    elsif days_left <= 30 then
      reminder_key := 'bank-reconnect:' || connection_row.id::text || ':' ||
        case
          when days_left <= 1 then '1'
          when days_left <= 7 then '7'
          when days_left <= 14 then '14'
          else '30'
        end;

      insert into public.notifications(user_id,type,severity,title,message,action_href,dedupe_key)
      values (
        uid,
        'bank_reconnect',
        case when days_left <= 7 then 'warning' else 'info' end,
        'Reconnexion bancaire à prévoir',
        format('%s devra être reconnectée dans %s jour%s. NEXORA te le rappelle pour éviter une interruption de synchronisation.',
          coalesce(connection_row.institution_name,'Ta banque'),
          days_left,
          case when days_left = 1 then '' else 's' end),
        '/banque',
        reminder_key
      )
      on conflict (user_id,dedupe_key) where dedupe_key is not null do nothing;
      if found then inserted_count := inserted_count + 1; end if;
    end if;
  end loop;

  if net > 0 and balance > safety and net >= 50 then
    insert into public.notifications(user_id, type, severity, title, message, action_href, dedupe_key)
    values (
      uid, 'saving_opportunity', 'success', 'Il est temps d’épargner',
      format('Ton mois est actuellement positif de %s €. Une partie peut être mise de côté tout en gardant ta réserve de sécurité.', to_char(net, 'FM999999990D00')),
      '/previsions', 'saving:' || month_start::text
    )
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    if found then inserted_count := inserted_count + 1; end if;
  end if;

  if planned > 0 and elapsed > 0 and spent / planned - elapsed >= 0.15 then
    insert into public.notifications(user_id, type, severity, title, message, action_href, dedupe_key)
    values (
      uid, 'budget_alert', case when spent / planned - elapsed >= 0.30 then 'danger' else 'warning' end,
      'Budget à surveiller',
      format('%s %% du budget des enveloppes est consommé pour environ %s %% du mois écoulé.', round((spent/planned)*100), round(elapsed*100)),
      '/budget', 'pace:' || month_start::text
    )
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    if found then inserted_count := inserted_count + 1; end if;
  end if;

  if net < 0 then
    insert into public.notifications(user_id, type, severity, title, message, action_href, dedupe_key)
    values (
      uid, 'forecast_alert', 'warning', 'Mois actuellement déficitaire',
      format('Les dépenses dépassent les revenus de %s € sur le mois en cours.', to_char(abs(net), 'FM999999990D00')),
      '/previsions', 'negative:' || month_start::text
    )
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    if found then inserted_count := inserted_count + 1; end if;
  end if;

  return inserted_count;
end;
$$;

revoke execute on function public.refresh_financial_notifications(uuid) from public, anon;
grant execute on function public.refresh_financial_notifications(uuid) to authenticated;

select pg_notify('pgrst', 'reload schema');
