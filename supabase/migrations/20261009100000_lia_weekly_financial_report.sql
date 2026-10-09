-- Weekly personal financial summary, scheduled in the user's Paris timezone.
-- The report only reads financial ledgers and sends an email; it never mutates financial records.

create unique index if not exists lia_runtime_jobs_weekly_financial_report_uidx
  on public.lia_runtime_jobs (user_id, (payload->>'action'))
  where runtime_type = 'cron' and payload->>'action' = 'weekly_financial_report';

create or replace function public.lia_ensure_weekly_financial_report_job()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_job_id uuid;
  v_next_run timestamptz;
begin
  if v_user_id is null then
    raise exception 'weekly_report_auth_required' using errcode = '42501';
  end if;

  select id into v_job_id
  from public.lia_runtime_jobs
  where user_id = v_user_id
    and runtime_type = 'cron'
    and payload->>'action' = 'weekly_financial_report'
  limit 1;

  if v_job_id is not null then
    return v_job_id;
  end if;

  v_next_run := (
    date_trunc('week', now() at time zone 'Europe/Paris')
    + interval '7 days'
    + interval '9 hours'
  ) at time zone 'Europe/Paris';

  insert into public.lia_runtime_jobs (
    user_id, runtime_type, name, description, schedule, status, payload,
    next_run_at, timezone, execution_mode, requires_policy_gate, requires_human_approval
  )
  values (
    v_user_id, 'cron', 'Bilan financier hebdomadaire',
    'Envoie un rapport des dépenses, des soldes connus et du score financier explicable.',
    '0 9 * * 1', 'ready',
    jsonb_build_object('action', 'weekly_financial_report', 'version', 1),
    v_next_run, 'Europe/Paris', 'no-agent', true, false
  )
  on conflict (user_id, (payload->>'action'))
    where runtime_type = 'cron' and payload->>'action' = 'weekly_financial_report'
  do nothing
  returning id into v_job_id;

  if v_job_id is null then
    select id into v_job_id
    from public.lia_runtime_jobs
    where user_id = v_user_id
      and runtime_type = 'cron'
      and payload->>'action' = 'weekly_financial_report'
    limit 1;
  end if;

  return v_job_id;
end;
$$;

revoke all on function public.lia_ensure_weekly_financial_report_job() from public, anon;
grant execute on function public.lia_ensure_weekly_financial_report_job() to authenticated;

comment on function public.lia_ensure_weekly_financial_report_job() is
  'Idempotently provisions a Monday 09:00 Europe/Paris weekly financial report for the authenticated user.';
