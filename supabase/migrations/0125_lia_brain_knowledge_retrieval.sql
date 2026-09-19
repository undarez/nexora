-- NEXORA Brain knowledge retrieval hardening.
-- Restores the lexical retrieval RPC used by src/lib/lia/financial-memory/pipeline.ts.
create or replace function public.search_financial_knowledge(
  p_query text,
  p_domain text default 'financial_agents',
  p_limit integer default 8,
  p_min_confidence numeric default 0.65
)
returns table(
  id uuid,
  knowledge_key text,
  knowledge_type text,
  domain text,
  title text,
  statement text,
  authority text,
  confidence numeric,
  status text,
  similarity numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    select plainto_tsquery('simple', left(coalesce(p_query, ''), 1000)) as ts
  ),
  scored as (
    select
      k.id,
      k.knowledge_key,
      k.knowledge_type,
      k.domain,
      k.title,
      k.statement,
      k.authority,
      k.confidence,
      k.status,
      greatest(
        0,
        ts_rank_cd(
          to_tsvector(
            'simple',
            coalesce(k.title, '') || ' ' ||
            coalesce(k.statement, '') || ' ' ||
            array_to_string(k.tags, ' ')
          ),
          q.ts
        )
      )::numeric as similarity
    from public.financial_knowledge_items k
    cross join q
    where k.status = 'validated'
      and k.confidence >= p_min_confidence
      and (
        p_domain is null
        or p_domain = ''
        or p_domain = 'financial_agents'
        or k.domain = p_domain
      )
      and (
        q.ts = ''::tsquery
        or to_tsvector(
          'simple',
          coalesce(k.title, '') || ' ' ||
          coalesce(k.statement, '') || ' ' ||
          array_to_string(k.tags, ' ')
        ) @@ q.ts
        or lower(
          k.title || ' ' || k.statement || ' ' || array_to_string(k.tags, ' ')
        ) like '%' || lower(left(coalesce(p_query, ''), 120)) || '%'
      )
  )
  select *
  from scored
  order by
    case authority
      when 'A' then 0
      when 'B' then 1
      when 'C' then 2
      when 'D' then 3
      else 4
    end,
    similarity desc,
    confidence desc
  limit greatest(1, least(coalesce(p_limit, 8), 20));
$$;

revoke all on function public.search_financial_knowledge(text,text,integer,numeric) from public;
grant execute on function public.search_financial_knowledge(text,text,integer,numeric) to authenticated, service_role;
