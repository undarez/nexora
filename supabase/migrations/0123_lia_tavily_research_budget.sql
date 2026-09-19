-- V5.16.04: governed monthly Tavily research budget.
-- Reuses the existing append-only provider usage ledger.

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
  v_used integer;
  v_guard_limit integer;
  v_new_used integer;
begin
  if p_provider is null or trim(p_provider) = '' then raise exception 'provider_required'; end if;
  if p_credits < 1 then raise exception 'credits_must_be_positive'; end if;
  if p_monthly_limit < 1 then raise exception 'monthly_limit_required'; end if;
  if p_guard_percent < 1 or p_guard_percent > 100 then raise exception 'invalid_guard_percent'; end if;

  v_guard_limit := greatest(1, floor(p_monthly_limit * p_guard_percent / 100.0)::integer);

  -- Serialize reservations for the same provider/month so concurrent searches
  -- cannot overshoot the guard threshold.
  perform pg_advisory_xact_lock(
    hashtext('lia-research-budget:' || trim(p_provider) || ':' || p_month_start::text)
  );

  select coalesce(sum(credits),0)::integer
    into v_used
  from public.lia_research_provider_usage
  where provider=trim(p_provider)
    and created_at >= p_month_start::timestamptz
    and created_at < (p_month_start + interval '1 month');

  v_new_used := v_used + p_credits;

  if v_new_used > v_guard_limit then
    return jsonb_build_object(
      'allowed', false,
      'provider', trim(p_provider),
      'month_start', p_month_start,
      'used_credits', v_used,
      'requested_credits', p_credits,
      'monthly_limit', p_monthly_limit,
      'guard_percent', p_guard_percent,
      'guard_limit', v_guard_limit,
      'remaining_credits', greatest(0, v_guard_limit-v_used)
    );
  end if;

  insert into public.lia_research_provider_usage(
    provider, operation, search_depth, credits, metadata
  )
  values (
    trim(p_provider), 'search', 'basic', p_credits,
    jsonb_build_object('budget_guarded', true, 'month_start', p_month_start, 'monthly_limit', p_monthly_limit, 'guard_percent', p_guard_percent)
  );

  return jsonb_build_object(
    'allowed', true,
    'provider', trim(p_provider),
    'month_start', p_month_start,
    'used_credits', v_new_used,
    'requested_credits', p_credits,
    'monthly_limit', p_monthly_limit,
    'guard_percent', p_guard_percent,
    'guard_limit', v_guard_limit,
    'remaining_credits', greatest(0, v_guard_limit-v_new_used)
  );
end;
$$;

revoke all on function public.lia_consume_research_provider_budget(text,date,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.lia_consume_research_provider_budget(text,date,integer,integer,integer) to service_role;
