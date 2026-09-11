create table if not exists public.lia_response_evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  loop_run_id uuid null,
  score integer not null check (score between 0 and 100),
  verdict text not null check (verdict in ('accepted','corrected','blocked')),
  corrected boolean not null default false,
  findings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.lia_response_evaluations enable row level security;
create policy "lia response evaluations owner select" on public.lia_response_evaluations
  for select to authenticated using (auth.uid() = user_id);
create policy "lia response evaluations owner insert" on public.lia_response_evaluations
  for insert to authenticated with check (auth.uid() = user_id);
