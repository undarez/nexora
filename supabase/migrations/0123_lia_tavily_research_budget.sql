-- V5.16.04: bounded Tavily research budget.
-- Global monthly usage is tracked server-side. A configurable guard blocks new
-- Tavily calls once the configured percentage of the monthly credit ceiling is reached.

create table if not exists public.lia_research_provider_usage (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  month_start date not null,
  search_count integer not null default 0 check (search_count >= 0),
  estimated_credits integer not null default 0 check (estimated_credits >= 0),
  last_used_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(provider, month_start)
);

create index if not exists idx_lia_research_provider_usage_provider_month
  on public.lia_research_provider_usage(provider, month_start desc);

alter table public.lia_research_provider_usage enable row level security;
revoke all on public.lia_research_provider_usage from public, anon, authenticated;

create or replace function public.lia_consume_research_provider_budget(
  p_provider text,
  p_month_start date,
  p_credits integer,
  p_monthly_limit integer,
  p_guard_percent integer default 90
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_row public.lia_research_provider_usage%rowtype;
  v_guard_limit integer;
  v_new_credits integer;
begin
  if p_provider is null or trim(p_provider) = '' then raise exception 'provider_required'; end if;
  if p_credits < 1 then raise exception 'credits_must_be_positive'; end if;
  if p_monthly_limit < 1 then raise exception 'monthly_limit_required'; end if;
  if p_guard_percent < 1 or p_guard_percent > 100 then raise exception 'invalid_guard_percent'; end if;

  v_guard_limit := greatest(1, floor(p_monthly_limit * p_guard_percent / 100.0)::integer);

  insert into public.lia_research_provider_usage(provider, month_start, search_count, estimated_credits, last_used_at, updated_at)
  values(trim(p_provider), p_month_start, 0, 0, now(), now())
  on conflict(provider, month_start) do nothing;

  select * into v_row
  from public.lia_research_provider_usage
  where provider=trim(p_provider) and month_start=p_month_start
  for update;

  v_new_credits := v_row.estimated_credits + p_credits;
  if v_new_credits > v_guard_limit then
    return jsonb_build_object(
      'allowed', false,
      'provider', v_row.provider,
      'month_start', v_row.month_start,
      'used_credits', v_row.estimated_credits,
      'requested_credits', p_credits,
      'monthly_limit', p_monthly_limit,
      'guard_percent', p_guard_percent,
      'guard_limit', v_guard_limit,
      'remaining_credits', greatest(0, v_guard_limit - v_row.estimated_credits)
    );
  end if;

  update public.lia_research_provider_usage
  set search_count=search_count+1,
      estimated_credits=v_new_credits,
      last_used_at=now(),
      updated_at=now()
  where id=v_row.id
  returning * into v_row;

  return jsonb_build_object(
    'allowed', true,
    'provider', v_row.provider,
    'month_start', v_row.month_start,
    'used_credits', v_row.estimated_credits,
    'requested_credits', p_credits,
    'monthly_limit', p_monthly_limit,
    'guard_percent', p_guard_percent,
    'guard_limit', v_guard_limit,
    'remaining_credits', greatest(0, v_guard_limit - v_row.estimated_credits)
  );
end;
$$;

revoke all on function public.lia_consume_research_provider_budget(text,date,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.lia_consume_research_provider_budget(text,date,integer,integer,integer) to service_role;
