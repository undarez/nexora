-- NEXORA Financial Agent Knowledge Pipeline
-- Additive migration. Reconcile with the live migration history before applying.

create extension if not exists pgcrypto;

create table if not exists public.financial_knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  title text not null,
  publisher text,
  source_date date,
  authority text not null check (authority in ('A','B','C','D','E')),
  url text not null,
  topics text[] not null default '{}',
  version text,
  checksum text,
  status text not null default 'active' check (status in ('active','archived','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.financial_knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.financial_knowledge_sources(id) on delete cascade,
  external_document_id text,
  title text,
  content_hash text,
  content_type text,
  language text default 'fr',
  fetched_at timestamptz,
  published_at timestamptz,
  version text,
  status text not null default 'ingested',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_financial_knowledge_document_hash
on public.financial_knowledge_documents(source_id, content_hash)
where content_hash is not null;

create table if not exists public.financial_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.financial_knowledge_documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  token_estimate integer,
  content_hash text,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(document_id, chunk_index)
);

create index if not exists idx_financial_knowledge_chunks_document
on public.financial_knowledge_chunks(document_id);

create table if not exists public.financial_knowledge_items (
  id uuid primary key default gen_random_uuid(),
  knowledge_key text not null unique,
  knowledge_type text not null check (knowledge_type in (
    'concept','claim','practice','risk','control',
    'capability','policy_candidate','evaluation_rule'
  )),
  domain text not null,
  title text not null,
  statement text not null,
  authority text not null check (authority in ('A','B','C','D','E')),
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  status text not null default 'proposed'
    check (status in ('proposed','validated','deprecated','conflicted')),
  effective_date date,
  review_date date,
  tags text[] not null default '{}',
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_financial_knowledge_items_domain
on public.financial_knowledge_items(domain, status, authority);

create table if not exists public.financial_knowledge_evidence (
  id uuid primary key default gen_random_uuid(),
  knowledge_id uuid not null references public.financial_knowledge_items(id) on delete cascade,
  source_id uuid not null references public.financial_knowledge_sources(id) on delete restrict,
  chunk_id uuid references public.financial_knowledge_chunks(id) on delete set null,
  evidence_location text,
  excerpt text,
  evidence_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_financial_knowledge_evidence_knowledge
on public.financial_knowledge_evidence(knowledge_id);

create table if not exists public.agent_knowledge_retrievals (
  id uuid primary key default gen_random_uuid(),
  agent_loop_run_id uuid,
  agent_loop_step_id uuid,
  query text not null,
  knowledge_id uuid references public.financial_knowledge_items(id) on delete set null,
  similarity numeric,
  rank integer,
  used_in_reasoning boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_knowledge_retrievals_run
on public.agent_knowledge_retrievals(agent_loop_run_id, created_at);

create table if not exists public.financial_knowledge_conflicts (
  id uuid primary key default gen_random_uuid(),
  knowledge_id_a uuid not null references public.financial_knowledge_items(id) on delete cascade,
  knowledge_id_b uuid not null references public.financial_knowledge_items(id) on delete cascade,
  conflict_type text not null,
  explanation text,
  resolution_status text not null default 'open'
    check (resolution_status in ('open','resolved','dismissed')),
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_financial_knowledge_conflicts_status
on public.financial_knowledge_conflicts(resolution_status);

-- RLS: default deny. Service-role ingestion may operate server-side.
alter table public.financial_knowledge_sources enable row level security;
alter table public.financial_knowledge_documents enable row level security;
alter table public.financial_knowledge_chunks enable row level security;
alter table public.financial_knowledge_items enable row level security;
alter table public.financial_knowledge_evidence enable row level security;
alter table public.agent_knowledge_retrievals enable row level security;
alter table public.financial_knowledge_conflicts enable row level security;
