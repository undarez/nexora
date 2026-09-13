create table if not exists public.lia_feedback_learning (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  signal text not null check (signal in ('helpful','not_helpful','accepted','rejected','corrected')),
  note text,
  recommendation_id uuid null,
  conversation_id uuid null,
  learning_gate text not null default 'candidate' check (learning_gate = 'candidate'),
  model_weight_update boolean not null default false,
  policy_update boolean not null default false,
  financial_fact_update boolean not null default false,
  evidence_weight numeric(4,3) not null default 0.4 check (evidence_weight >= 0 and evidence_weight <= 1),
  reviewed_at timestamptz null,
  reviewed_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_lia_feedback_learning_user_created
  on public.lia_feedback_learning(user_id, created_at desc);

alter table public.lia_feedback_learning enable row level security;

drop policy if exists lia_feedback_learning_owner on public.lia_feedback_learning;
create policy lia_feedback_learning_owner on public.lia_feedback_learning
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists lia_feedback_learning_insert_owner on public.lia_feedback_learning;
create policy lia_feedback_learning_insert_owner on public.lia_feedback_learning
  for insert to authenticated with check (auth.uid() = user_id);

revoke all on public.lia_feedback_learning from anon;
