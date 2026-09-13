-- LIA Cognitive Core: durable memory, knowledge, learning, evaluation and governance.
-- Model outputs are never granted database authority by this schema.
create table if not exists public.lia_cognitive_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  understanding_score numeric(5,2) not null default 50,
  reasoning_score numeric(5,2) not null default 50,
  knowledge_score numeric(5,2) not null default 50,
  planning_score numeric(5,2) not null default 50,
  problem_solving_score numeric(5,2) not null default 50,
  tool_use_score numeric(5,2) not null default 50,
  research_score numeric(5,2) not null default 50,
  verification_score numeric(5,2) not null default 50,
  metacognition_score numeric(5,2) not null default 50,
  memory_score numeric(5,2) not null default 50,
  learning_score numeric(5,2) not null default 50,
  autonomy_score numeric(5,2) not null default 0,
  safety_score numeric(5,2) not null default 100,
  autonomy_level integer not null default 1 check (autonomy_level between 0 and 8),
  updated_at timestamptz not null default now()
);

create table if not exists public.lia_knowledge (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  claim text not null,
  source text,
  source_type text,
  publication_date date,
  retrieval_date timestamptz not null default now(),
  confidence numeric(5,2) not null default 0,
  corroboration jsonb not null default '[]'::jsonb,
  contradictions jsonb not null default '[]'::jsonb,
  expiration timestamptz,
  state text not null default 'uncertain' check (state in ('known','unknown','uncertain','assumed','verified','contradicted')),
  verified boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.lia_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  memory_type text not null check (memory_type in ('working','episodic','semantic','procedural','strategic')),
  topic text not null,
  content jsonb not null default '{}'::jsonb,
  source_kind text,
  source_id uuid,
  reliability numeric(5,2) not null default 0,
  reproducible boolean,
  expires_at timestamptz,
  status text not null default 'candidate' check (status in ('candidate','accepted','stale','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lia_learning_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  loop_run_id uuid references public.agent_loop_runs(id) on delete set null,
  context jsonb not null default '{}'::jsonb,
  action jsonb not null default '{}'::jsonb,
  expected_result jsonb not null default '{}'::jsonb,
  actual_result jsonb not null default '{}'::jsonb,
  cause text,
  correction jsonb not null default '{}'::jsonb,
  validation jsonb not null default '{}'::jsonb,
  lesson text not null,
  abstraction text,
  reproducible boolean,
  confidence numeric(5,2) not null default 0,
  memory_gate text not null default 'candidate' check (memory_gate in ('candidate','accepted','rejected','stale')),
  created_at timestamptz not null default now()
);

create table if not exists public.lia_evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  loop_run_id uuid references public.agent_loop_runs(id) on delete set null,
  dimension text not null,
  score numeric(5,2) not null,
  critical boolean not null default false,
  passed boolean not null default false,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.lia_tool_policies (
  id uuid primary key default gen_random_uuid(),
  tool_key text not null unique,
  risk_level text not null check (risk_level in ('read','write','delete','execute','external','irreversible','critical')),
  min_autonomy_level integer not null default 0 check (min_autonomy_level between 0 and 8),
  human_approval_required boolean not null default false,
  reversible boolean not null default true,
  enabled boolean not null default true,
  policy jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.lia_tool_policies (tool_key,risk_level,min_autonomy_level,human_approval_required,reversible) values
 ('get_financial_snapshot','read',0,false,true),
 ('get_budget_status','read',0,false,true),
 ('get_cashflow','read',0,false,true),
 ('get_wealth_snapshot','read',0,false,true),
 ('get_forecast','read',0,false,true),
 ('search_transactions','read',0,false,true),
 ('create_recommendation','write',2,true,true)
on conflict (tool_key) do nothing;

create index if not exists idx_lia_knowledge_user_state on public.lia_knowledge(user_id,state);
create index if not exists idx_lia_memory_user_type on public.lia_memory(user_id,memory_type,status);
create index if not exists idx_lia_learning_user_gate on public.lia_learning_records(user_id,memory_gate);
create index if not exists idx_lia_eval_loop on public.lia_evaluations(loop_run_id,dimension);

alter table public.lia_cognitive_profiles enable row level security;
alter table public.lia_knowledge enable row level security;
alter table public.lia_memory enable row level security;
alter table public.lia_learning_records enable row level security;
alter table public.lia_evaluations enable row level security;
alter table public.lia_tool_policies enable row level security;

drop policy if exists lia_profile_owner on public.lia_cognitive_profiles;
create policy lia_profile_owner on public.lia_cognitive_profiles for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists lia_knowledge_owner on public.lia_knowledge;
create policy lia_knowledge_owner on public.lia_knowledge for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists lia_memory_owner on public.lia_memory;
create policy lia_memory_owner on public.lia_memory for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists lia_learning_owner on public.lia_learning_records;
create policy lia_learning_owner on public.lia_learning_records for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists lia_eval_owner on public.lia_evaluations;
create policy lia_eval_owner on public.lia_evaluations for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
-- Tool policies are internal governance data: no client Data API access.
revoke all on public.lia_tool_policies from anon, authenticated;
revoke all on public.lia_tool_policies from public;

create or replace function public.touch_lia_updated_at() returns trigger language plpgsql security invoker set search_path = public as $$
begin new.updated_at=now(); return new; end; $$;
drop trigger if exists trg_lia_profile_updated on public.lia_cognitive_profiles;
create trigger trg_lia_profile_updated before update on public.lia_cognitive_profiles for each row execute function public.touch_lia_updated_at();
drop trigger if exists trg_lia_memory_updated on public.lia_memory;
create trigger trg_lia_memory_updated before update on public.lia_memory for each row execute function public.touch_lia_updated_at();
drop trigger if exists trg_lia_policy_updated on public.lia_tool_policies;
create trigger trg_lia_policy_updated before update on public.lia_tool_policies for each row execute function public.touch_lia_updated_at();

comment on table public.lia_memory is 'Five-tier LIA memory. Permanent memory requires a Memory Gate decision.';
comment on table public.lia_learning_records is 'Validated lessons from agent experiences; never treated as model-weight updates.';
comment on table public.lia_evaluations is 'Multidimensional agent evaluations; critical failures must not be hidden by averages.';
comment on table public.lia_tool_policies is 'Server-side governance policy; never writable by the model or browser.';
