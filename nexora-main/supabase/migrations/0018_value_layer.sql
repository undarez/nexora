-- Gérer Finance v4.32 → v4.39 — Value layer
-- Persistent recurring patterns, financial goals metadata, month closures and
-- AI learning proposals. All user-scoped; the model never receives write authority.

create table if not exists public.recurring_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label_key text not null,
  display_label text not null,
  amount numeric(14,2) not null check (amount > 0),
  cadence text not null default 'monthly' check (cadence in ('weekly','monthly','quarterly','yearly','unknown')),
  occurrences integer not null default 2 check (occurrences >= 2),
  last_seen date,
  category_id uuid references public.categories(id) on delete set null,
  status text not null default 'detected' check (status in ('detected','confirmed','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, label_key, amount)
);
create index if not exists recurring_patterns_user_idx on public.recurring_patterns(user_id, status, updated_at desc);
alter table public.recurring_patterns enable row level security;
drop policy if exists recurring_patterns_own on public.recurring_patterns;
create policy recurring_patterns_own on public.recurring_patterns for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.monthly_closures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  income numeric(14,2) not null default 0,
  expenses numeric(14,2) not null default 0,
  net numeric(14,2) not null default 0,
  budget_adherence numeric(6,2),
  notes text,
  prepared_next_period boolean not null default false,
  closed_at timestamptz not null default now(),
  unique(user_id, period_start)
);
alter table public.monthly_closures enable row level security;
drop policy if exists monthly_closures_own on public.monthly_closures;
create policy monthly_closures_own on public.monthly_closures for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.ai_learning_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_type text not null check (memory_type in ('observation','correction','proposal','decision')),
  topic text not null,
  before_value jsonb,
  after_value jsonb,
  evidence jsonb not null default '{}'::jsonb,
  confidence numeric(5,2),
  status text not null default 'pending' check (status in ('pending','accepted','rejected','archived')),
  created_at timestamptz not null default now()
);
create index if not exists ai_learning_memory_user_idx on public.ai_learning_memory(user_id, created_at desc);
alter table public.ai_learning_memory enable row level security;
drop policy if exists ai_learning_memory_own on public.ai_learning_memory;
create policy ai_learning_memory_own on public.ai_learning_memory for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Keep updated_at server controlled for recurring patterns.
create or replace function public.touch_recurring_patterns_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin NEW.updated_at = now(); return NEW; end; $$;
revoke execute on function public.touch_recurring_patterns_updated_at() from public, anon, authenticated;
drop trigger if exists recurring_patterns_touch on public.recurring_patterns;
create trigger recurring_patterns_touch before update on public.recurring_patterns for each row execute procedure public.touch_recurring_patterns_updated_at();

comment on table public.ai_learning_memory is 'Human-supervised learning memory. LLM may propose observations; only deterministic server code or the user changes financial facts.';
