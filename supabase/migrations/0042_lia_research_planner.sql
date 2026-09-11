create table if not exists public.lia_research_plans (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 query text not null, unknowns jsonb not null default '[]'::jsonb, steps jsonb not null default '[]'::jsonb,
 stop_rules jsonb not null default '{}'::jsonb, max_sources_per_step integer not null default 8,
 execution_allowed boolean not null default false, created_at timestamptz not null default now()
);
alter table public.lia_research_plans enable row level security;
create policy "lia research plans own read" on public.lia_research_plans for select using (auth.uid()=user_id);
revoke insert, update, delete on public.lia_research_plans from anon, authenticated;
