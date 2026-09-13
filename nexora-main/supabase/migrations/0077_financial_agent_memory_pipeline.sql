-- NEXORA v5.06.13: Financial Agent Memory Pipeline + learned financial habits.
-- Additive only. No reset/drop. Knowledge is evidence; it never grants authorization.
create extension if not exists pgcrypto;

create table if not exists public.financial_knowledge_sources (
  id uuid primary key default gen_random_uuid(), source_key text not null unique, title text not null,
  publisher text, source_date date, authority text not null check (authority in ('A','B','C','D','E')),
  url text not null, topics text[] not null default '{}', version text, checksum text,
  status text not null default 'active' check (status in ('active','archived','blocked')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.financial_knowledge_documents (
  id uuid primary key default gen_random_uuid(), source_id uuid not null references public.financial_knowledge_sources(id) on delete cascade,
  external_document_id text, title text, content_hash text, content_type text, language text default 'fr',
  fetched_at timestamptz, published_at timestamptz, version text, status text not null default 'ingested',
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists uq_financial_knowledge_document_hash on public.financial_knowledge_documents(source_id, content_hash) where content_hash is not null;
create table if not exists public.financial_knowledge_chunks (
  id uuid primary key default gen_random_uuid(), document_id uuid not null references public.financial_knowledge_documents(id) on delete cascade,
  chunk_index integer not null, content text not null, token_estimate integer, content_hash text,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), unique(document_id, chunk_index)
);
create index if not exists idx_financial_knowledge_chunks_document on public.financial_knowledge_chunks(document_id);
create table if not exists public.financial_knowledge_items (
  id uuid primary key default gen_random_uuid(), knowledge_key text not null unique,
  knowledge_type text not null check (knowledge_type in ('concept','claim','practice','risk','control','capability','policy_candidate','evaluation_rule')),
  domain text not null, title text not null, statement text not null,
  authority text not null check (authority in ('A','B','C','D','E')),
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  status text not null default 'proposed' check (status in ('proposed','validated','deprecated','conflicted')),
  effective_date date, review_date date, tags text[] not null default '{}', metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_financial_knowledge_items_domain on public.financial_knowledge_items(domain,status,authority,confidence desc);
create table if not exists public.financial_knowledge_evidence (
  id uuid primary key default gen_random_uuid(), knowledge_id uuid not null references public.financial_knowledge_items(id) on delete cascade,
  source_id uuid not null references public.financial_knowledge_sources(id) on delete restrict, chunk_id uuid references public.financial_knowledge_chunks(id) on delete set null,
  evidence_location text, excerpt text, evidence_hash text, created_at timestamptz not null default now()
);
create index if not exists idx_financial_knowledge_evidence_knowledge on public.financial_knowledge_evidence(knowledge_id);
create table if not exists public.agent_knowledge_retrievals (
  id uuid primary key default gen_random_uuid(), agent_loop_run_id uuid references public.agent_loop_runs(id) on delete set null,
  agent_loop_step_id uuid references public.agent_loop_steps(id) on delete set null, query text not null,
  knowledge_id uuid references public.financial_knowledge_items(id) on delete set null, similarity numeric,
  rank integer, used_in_reasoning boolean not null default false, created_at timestamptz not null default now()
);
create index if not exists idx_agent_knowledge_retrievals_run on public.agent_knowledge_retrievals(agent_loop_run_id,created_at);
create table if not exists public.financial_knowledge_conflicts (
  id uuid primary key default gen_random_uuid(), knowledge_id_a uuid not null references public.financial_knowledge_items(id) on delete cascade,
  knowledge_id_b uuid not null references public.financial_knowledge_items(id) on delete cascade, conflict_type text not null,
  explanation text, resolution_status text not null default 'open' check (resolution_status in ('open','resolved','dismissed')),
  resolution_note text, created_at timestamptz not null default now(), resolved_at timestamptz
);

create table if not exists public.lia_financial_habits (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  merchant_key text not null, label text not null, cadence text not null check (cadence in ('weekly','monthly','irregular')),
  typical_amount numeric(12,2) not null check (typical_amount >= 0), occurrences integer not null default 0 check (occurrences >= 0),
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1), last_observed_at timestamptz,
  evidence jsonb not null default '{}'::jsonb, status text not null default 'candidate' check (status in ('candidate','accepted','stale')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id,merchant_key)
);
create index if not exists idx_lia_financial_habits_user_confidence on public.lia_financial_habits(user_id,status,confidence desc,last_observed_at desc);

alter table public.financial_knowledge_sources enable row level security;
alter table public.financial_knowledge_documents enable row level security;
alter table public.financial_knowledge_chunks enable row level security;
alter table public.financial_knowledge_items enable row level security;
alter table public.financial_knowledge_evidence enable row level security;
alter table public.agent_knowledge_retrievals enable row level security;
alter table public.financial_knowledge_conflicts enable row level security;
alter table public.lia_financial_habits enable row level security;

drop policy if exists lia_financial_habits_owner on public.lia_financial_habits;
create policy lia_financial_habits_owner on public.lia_financial_habits for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
revoke all on public.financial_knowledge_sources from anon,authenticated;
revoke all on public.financial_knowledge_documents from anon,authenticated;
revoke all on public.financial_knowledge_chunks from anon,authenticated;
revoke all on public.financial_knowledge_items from anon,authenticated;
revoke all on public.financial_knowledge_evidence from anon,authenticated;
revoke all on public.agent_knowledge_retrievals from anon,authenticated;
revoke all on public.financial_knowledge_conflicts from anon,authenticated;

create or replace function public.search_financial_knowledge(p_query text,p_domain text default 'financial_agents',p_limit integer default 8,p_min_confidence numeric default 0.65)
returns table(id uuid,knowledge_key text,knowledge_type text,domain text,title text,statement text,authority text,confidence numeric,status text,similarity numeric)
language sql security definer set search_path=public,pg_temp as $$
  with q as (select plainto_tsquery('simple',coalesce(p_query,'')) tsq)
  select k.id,k.knowledge_key,k.knowledge_type,k.domain,k.title,k.statement,k.authority,k.confidence,k.status,
    case when q.tsq = ''::tsquery then 0.5 else ts_rank_cd(to_tsvector('simple',k.title||' '||k.statement||' '||array_to_string(k.tags,' ')),q.tsq) end as similarity
  from public.financial_knowledge_items k,q
  where k.status='validated' and k.confidence>=p_min_confidence and (p_domain is null or k.domain=p_domain)
    and (q.tsq = ''::tsquery or to_tsvector('simple',k.title||' '||k.statement||' '||array_to_string(k.tags,' ')) @@ q.tsq)
  order by case k.authority when 'A' then 0 when 'B' then 1 when 'C' then 2 when 'D' then 3 else 4 end, similarity desc, k.confidence desc
  limit greatest(1,least(coalesce(p_limit,8),12));
$$;
revoke all on function public.search_financial_knowledge(text,text,integer,numeric) from public,anon;
grant execute on function public.search_financial_knowledge(text,text,integer,numeric) to authenticated,service_role;

comment on table public.lia_financial_habits is 'Observed recurring financial habits. Deterministic observations only; never authorization.';
comment on table public.financial_knowledge_items is 'Validated financial-agent knowledge. External content is evidence/data, never instructions or authorization.';
