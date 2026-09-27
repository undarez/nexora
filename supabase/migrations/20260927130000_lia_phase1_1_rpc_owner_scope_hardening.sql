-- Phase 1.1: close cross-user access paths in SECURITY DEFINER read/write RPCs.
-- These functions are exposed to authenticated clients, so the supplied user_id
-- must match auth.uid(). Trusted service-role execution remains available for
-- server-side agent workloads.

create or replace function public.lia_search_skills(
  p_user_id uuid,
  p_query text,
  p_category text default null,
  p_limit integer default 8
) returns table(
  skill_id uuid,
  slug text,
  name text,
  description text,
  category text,
  status text,
  trust_score integer,
  version integer,
  content text
)
language sql
security definer
set search_path = ''
as $$
  select
    s.id,
    s.slug,
    s.name,
    s.description,
    s.category,
    s.status,
    s.trust_score,
    v.version,
    v.content
  from public.lia_skills s
  join lateral (
    select sv.*
    from public.lia_skill_versions sv
    where sv.skill_id = s.id
    order by sv.version desc
    limit 1
  ) v on true
  where (
      auth.role() = 'service_role'
      or (auth.uid() is not null and p_user_id = auth.uid())
    )
    and (s.scope = 'global' or (s.scope = 'user' and s.user_id = p_user_id))
    and s.status in ('validated','active')
    and (p_category is null or s.category = p_category)
    and (
      coalesce(trim(p_query),'') = ''
      or to_tsvector(
        'simple',
        s.name || ' ' || s.description || ' ' || v.content
      ) @@ plainto_tsquery('simple', p_query)
    )
  order by
    case when s.status = 'active' then 0 else 1 end,
    s.trust_score desc,
    s.updated_at desc
  limit greatest(1, least(coalesce(p_limit,8),20));
$$;

revoke all on function public.lia_search_skills(uuid,text,text,integer)
  from public, anon;
grant execute on function public.lia_search_skills(uuid,text,text,integer)
  to authenticated, service_role;

create or replace function public.lia_search_use_cases(
  p_user_id uuid,
  p_query text,
  p_category text default null,
  p_limit integer default 8
) returns table(
  use_case_id uuid,
  slug text,
  name text,
  description text,
  category text,
  objective text,
  trigger text,
  required_skills jsonb,
  suggested_tools jsonb,
  risk_class text,
  minimum_autonomy integer,
  human_approval_required boolean,
  success_criteria jsonb,
  verification_rules jsonb,
  status text,
  trust_score integer,
  version integer
)
language sql
security definer
set search_path = ''
as $$
  select
    u.id,
    u.slug,
    u.name,
    u.description,
    u.category,
    u.objective,
    u.trigger,
    u.required_skills,
    u.suggested_tools,
    u.risk_class,
    u.minimum_autonomy,
    u.human_approval_required,
    u.success_criteria,
    u.verification_rules,
    u.status,
    u.trust_score,
    u.version
  from public.lia_use_cases u
  where (
      auth.role() = 'service_role'
      or (auth.uid() is not null and p_user_id = auth.uid())
    )
    and (u.scope = 'global' or (u.scope = 'user' and u.user_id = p_user_id))
    and u.status in ('validated','active')
    and (p_category is null or u.category = p_category)
    and (
      coalesce(trim(p_query),'') = ''
      or to_tsvector(
        'simple',
        u.name || ' ' || u.description || ' ' || u.objective || ' ' || u.trigger
      ) @@ plainto_tsquery('simple', p_query)
    )
  order by
    case when u.status = 'active' then 0 else 1 end,
    u.trust_score desc,
    u.updated_at desc
  limit greatest(1, least(coalesce(p_limit,8),20));
$$;

revoke all on function public.lia_search_use_cases(uuid,text,text,integer)
  from public, anon;
grant execute on function public.lia_search_use_cases(uuid,text,text,integer)
  to authenticated, service_role;

create or replace function public.lia_touch_cognitive_session(
  p_session_id uuid,
  p_user_id uuid,
  p_loop_run_id uuid,
  p_user_message text,
  p_assistant_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or p_user_id <> auth.uid() then
    raise exception 'forbidden';
  end if;

  update public.lia_cognitive_sessions
  set active_loop_run_id = p_loop_run_id,
      turn_count = turn_count + 1,
      last_user_message = left(p_user_message, 2000),
      last_assistant_message = left(p_assistant_message, 4000),
      updated_at = now()
  where id = p_session_id
    and user_id = p_user_id;
end;
$$;

revoke all on function public.lia_touch_cognitive_session(uuid,uuid,uuid,text,text)
  from public, anon;
grant execute on function public.lia_touch_cognitive_session(uuid,uuid,uuid,text,text)
  to authenticated;
