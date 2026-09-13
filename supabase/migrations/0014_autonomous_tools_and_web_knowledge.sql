-- Governed self-improvement: tools are declarative/read-only capabilities, never arbitrary code.
create table if not exists public.lia_dynamic_tools (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null,
  kind text not null check (kind in ('composite-read')),
  schema jsonb not null default '{"type":"object","properties":{},"additionalProperties":false}'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('candidate','active','disabled','rejected')),
  safety jsonb not null default '{}'::jsonb,
  created_by text not null default 'agent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);

alter table public.lia_dynamic_tools enable row level security;
drop policy if exists "lia dynamic tools own" on public.lia_dynamic_tools;
create policy "lia dynamic tools own" on public.lia_dynamic_tools for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create index if not exists lia_dynamic_tools_user_status_idx on public.lia_dynamic_tools(user_id, status, created_at desc);

-- Store actual source text so knowledge enrichment can be performed without a paid search API.
alter table public.knowledge_items
  add column if not exists content text,
  add column if not exists source_url text,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb,
  add column if not exists retrieved_at timestamptz;

alter table public.knowledge_sources enable row level security;
alter table public.knowledge_items enable row level security;

drop policy if exists "knowledge sources readable" on public.knowledge_sources;
create policy "knowledge sources readable" on public.knowledge_sources for select to authenticated using (true);

drop policy if exists "knowledge items readable" on public.knowledge_items;
create policy "knowledge items readable" on public.knowledge_items for select to authenticated using (true);

create index if not exists knowledge_items_hash_idx on public.knowledge_items(content_hash);
create index if not exists knowledge_items_retrieved_idx on public.knowledge_items(retrieved_at desc);

comment on table public.lia_dynamic_tools is 'NEXORA self-created tools. Only declarative composite-read tools are allowed; arbitrary code and unrestricted network access are intentionally impossible.';
comment on column public.knowledge_items.content is 'Sanitized extracted source text used by the NEXORA knowledge pipeline.';
