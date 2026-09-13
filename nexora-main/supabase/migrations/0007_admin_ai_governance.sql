create table if not exists public.ai_improvement_proposals (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null,
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status text not null default 'proposed' check (status in ('proposed','approved','rejected','in_progress','completed')),
  paperclip_issue_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ai_improvement_proposals enable row level security;
create policy "admin ai proposals own" on public.ai_improvement_proposals for all to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create index if not exists ai_improvement_proposals_created_idx on public.ai_improvement_proposals(created_at desc);
