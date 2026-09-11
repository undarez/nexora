-- v4.19 defense-in-depth.
create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in (
    'auth_denied','admin_denied','rate_limited','suspicious_request',
    'session_ejected','policy_blocked'
  )),
  route text,
  ip_hash text,
  user_agent_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists security_events_user_created_idx on public.security_events(user_id, created_at desc);
create index if not exists security_events_type_created_idx on public.security_events(event_type, created_at desc);

alter table public.security_events enable row level security;
revoke all on public.security_events from anon, authenticated;

do $$
declare t text;
begin
  foreach t in array ARRAY[
    'profiles','accounts','categories','transactions','budgets','budget_lines',
    'goals','forecasts','learning_events','recommendations','fixed_expenses',
    'bank_connections','bank_accounts','bank_transactions',
    'wealth_entries','forecast_inputs','bank_consent_events',
    'agent_loop_runs','agent_loop_steps','agent_evidence'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;
