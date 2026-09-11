create table if not exists public.lia_research_acquisitions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 requested_url text not null, final_url text not null, status integer not null, content_type text not null,
 title text, text text not null, observed_at timestamptz not null default now(), redirects integer not null default 0,
 truncated boolean not null default false, source_host text not null, execution_allowed boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.lia_research_acquisitions enable row level security;
create policy "lia research acquisitions own read" on public.lia_research_acquisitions for select using (auth.uid()=user_id);
revoke insert, update, delete on public.lia_research_acquisitions from anon, authenticated;
