-- v5.04.9: compact long-term strategy memory. Summaries never grant authority.
create table if not exists public.lia_strategy_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  goal_key text not null,
  strategy_key text not null,
  sample_size integer not null default 0 check (sample_size >= 0),
  decayed_score integer not null default 0 check (decayed_score between -100 and 100),
  success_rate numeric(5,3) not null default 0 check (success_rate between 0 and 1),
  consistency numeric(5,3) not null default 0 check (consistency between 0 and 1),
  confidence numeric(5,3) not null default 0 check (confidence between 0 and 1),
  contradiction boolean not null default false,
  last_observed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(user_id, goal_key, strategy_key)
);
create index if not exists idx_lia_strategy_memory_rank on public.lia_strategy_memory(user_id, goal_key, confidence desc, decayed_score desc);
alter table public.lia_strategy_memory enable row level security;
drop policy if exists lia_strategy_memory_owner on public.lia_strategy_memory;
create policy lia_strategy_memory_owner on public.lia_strategy_memory for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
comment on table public.lia_strategy_memory is 'Compact empirical strategy memory with decay/confidence; never grants authority or changes policies.';
