-- Retrieval RPC using pgvector.
-- Reconcile vector dimension with the embedding model used by Nexora before applying.

create or replace function public.match_financial_knowledge(
  query_embedding vector(1536),
  match_count integer default 8,
  min_confidence numeric default 0.65,
  requested_domain text default null
)
returns table (
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
as $$
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
    1 - (k.embedding <=> query_embedding) as similarity
  from public.financial_knowledge_items k
  where k.embedding is not null
    and k.confidence >= min_confidence
    and k.status = 'validated'
    and (requested_domain is null or k.domain = requested_domain)
  order by
    case k.authority when 'A' then 0 when 'B' then 1 when 'C' then 2 when 'D' then 3 else 4 end,
    k.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;
