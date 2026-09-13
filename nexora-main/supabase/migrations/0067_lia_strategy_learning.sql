-- v5.04.6: bounded strategy learning from observed outcomes.
create table if not exists public.lia_strategy_experiences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  goal_key text not null,
  strategy_key text not null,
  outcome text not null check (outcome in ('success','partial','failed','blocked','human_required')),
  score integer not null check (score between -100 and 100),
  context jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_lia_strategy_experiences_lookup on public.lia_strategy_experiences(user_id, goal_key, strategy_key, created_at desc);
alter table public.lia_strategy_experiences enable row level security;
drop policy if exists lia_strategy_experiences_owner on public.lia_strategy_experiences;
create policy lia_strategy_experiences_owner on public.lia_strategy_experiences for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create or replace function public.lia_record_strategy_experience(p_user_id uuid, p_goal_key text, p_strategy_key text, p_outcome text, p_score integer, p_context jsonb default '{}'::jsonb, p_evidence jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'forbidden'; end if;
  insert into public.lia_strategy_experiences(user_id,goal_key,strategy_key,outcome,score,context,evidence)
  values(p_user_id, left(trim(p_goal_key),160), left(trim(p_strategy_key),120), p_outcome, greatest(-100,least(100,p_score)), coalesce(p_context,'{}'::jsonb), coalesce(p_evidence,'[]'::jsonb)) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.lia_record_strategy_experience(uuid,text,text,text,integer,jsonb,jsonb) from public;
grant execute on function public.lia_record_strategy_experience(uuid,text,text,text,integer,jsonb,jsonb) to authenticated;
comment on table public.lia_strategy_experiences is 'Bounded empirical strategy outcomes; never changes permissions or autonomy.';
