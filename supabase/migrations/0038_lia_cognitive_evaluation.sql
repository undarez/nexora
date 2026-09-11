-- v4.70: multidimensional cognitive evaluation and deterministic version selection evidence.
create table if not exists public.lia_cognitive_evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  baseline_version_id text not null,
  candidate_version_id text not null,
  baseline jsonb not null default '{}'::jsonb,
  candidate jsonb not null default '{}'::jsonb,
  comparison jsonb not null default '{}'::jsonb,
  verdict text not null,
  selected_version_id text,
  activation_allowed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_lia_cognitive_evaluations_user_time on public.lia_cognitive_evaluations(user_id, created_at desc);
alter table public.lia_cognitive_evaluations enable row level security;
drop policy if exists lia_cognitive_evaluations_owner_read on public.lia_cognitive_evaluations;
create policy lia_cognitive_evaluations_owner_read on public.lia_cognitive_evaluations for select to authenticated using (user_id=auth.uid());
revoke insert, update, delete on public.lia_cognitive_evaluations from public, anon, authenticated;
comment on table public.lia_cognitive_evaluations is 'Multidimensional cognitive evaluation evidence. Safety is a hard gate; this table never grants activation authority.';
