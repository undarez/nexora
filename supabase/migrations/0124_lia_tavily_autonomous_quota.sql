-- V5.16.05: reserve 20% of the monthly Tavily request budget for autonomous LIA learning.
-- The remaining 80% is the user/admin research pool. The reservation is hard:
-- unused autonomous capacity is not silently consumed by manual searches.

drop function if exists public.lia_consume_research_provider_budget(text,date,integer,integer,integer);

create or replace function public.lia_consume_research_provider_budget(
  p_provider text,
  p_month_start date,
  p_credits integer,
  p_monthly_limit integer,
  p_guard_percent integer default 100,
  p_pool text default 'user'
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_total_used integer;
  v_pool_used integer;
  v_pool_limit integer;
  v_autonomous_reserve integer;
  v_new_pool_used integer;
begin
  if p_provider is null or trim(p_provider) = '' then raise exception 'provider_required'; end if;
  if p_credits < 1 then raise exception 'credits_must_be_positive'; end if;
  if p_monthly_limit < 1 then raise exception 'monthly_limit_required'; end if;
  if p_guard_percent < 1 or p_guard_percent > 100 then raise exception 'invalid_guard_percent'; end if;
  if p_pool not in ('user','autonomous') then raise exception 'invalid_budget_pool'; end if;

  v_autonomous_reserve := greatest(1, floor(p_monthly_limit * 20 / 100.0)::integer);
  v_pool_limit := case
    when p_pool = 'autonomous' then v_autonomous_reserve
    else greatest(0, floor(p_monthly_limit * 80 / 100.0)::integer)
  end;

  if p_guard_percent < 100 then
    v_pool_limit := least(v_pool_limit, greatest(0, floor(p_monthly_limit * p_guard_percent / 100.0)::integer));
  end if;

  perform pg_advisory_xact_lock(
    hashtext('lia-research-budget:' || trim(p_provider) || ':' || p_month_start::text)
  );

  select coalesce(sum(credits),0)::integer
    into v_total_used
  from public.lia_research_provider_usage
  where provider=trim(p_provider)
    and created_at >= p_month_start::timestamptz
    and created_at < (p_month_start + interval '1 month');

  select coalesce(sum(credits),0)::integer
    into v_pool_used
  from public.lia_research_provider_usage
  where provider=trim(p_provider)
    and created_at >= p_month_start::timestamptz
    and created_at < (p_month_start + interval '1 month')
    and coalesce(metadata->>'budget_pool','user') = p_pool;

  v_new_pool_used := v_pool_used + p_credits;

  if v_new_pool_used > v_pool_limit or v_total_used + p_credits > p_monthly_limit then
    return jsonb_build_object(
      'allowed', false,
      'provider', trim(p_provider),
      'pool', p_pool,
      'month_start', p_month_start,
      'used_credits', v_pool_used,
      'total_used_credits', v_total_used,
      'requested_credits', p_credits,
      'monthly_limit', p_monthly_limit,
      'autonomous_reserve', v_autonomous_reserve,
      'pool_limit', v_pool_limit,
      'remaining_credits', greatest(0, v_pool_limit-v_pool_used)
    );
  end if;

  insert into public.lia_research_provider_usage(provider, operation, search_depth, credits, metadata)
  values (
    trim(p_provider),
    'search',
    'basic',
    p_credits,
    jsonb_build_object(
      'budget_guarded', true,
      'budget_pool', p_pool,
      'month_start', p_month_start,
      'monthly_limit', p_monthly_limit,
      'autonomous_reserve_percent', 20,
      'autonomous_reserve', v_autonomous_reserve
    )
  );

  return jsonb_build_object(
    'allowed', true,
    'provider', trim(p_provider),
    'pool', p_pool,
    'month_start', p_month_start,
    'used_credits', v_new_pool_used,
    'total_used_credits', v_total_used + p_credits,
    'requested_credits', p_credits,
    'monthly_limit', p_monthly_limit,
    'autonomous_reserve', v_autonomous_reserve,
    'pool_limit', v_pool_limit,
    'remaining_credits', greatest(0, v_pool_limit-v_new_pool_used)
  );
end;
$$;

revoke all on function public.lia_consume_research_provider_budget(text,date,integer,integer,integer,text) from public,anon,authenticated;
grant execute on function public.lia_consume_research_provider_budget(text,date,integer,integer,integer,text) to service_role;
