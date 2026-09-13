-- v5.04.8: contextual strategy memory. Learning ranks strategies by prior outcomes in similar contexts.
alter table public.lia_strategy_experiences
  add column if not exists context_key text;

create index if not exists idx_lia_strategy_experiences_context
  on public.lia_strategy_experiences(user_id, context_key, strategy_key, created_at desc);

create or replace function public.lia_record_strategy_experience(
  p_user_id uuid,
  p_goal_key text,
  p_strategy_key text,
  p_outcome text,
  p_score integer,
  p_context jsonb default '{}'::jsonb,
  p_evidence jsonb default '[]'::jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_context_key text;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'forbidden'; end if;
  v_context_key := left(coalesce(p_context->>'strategy_context_key',''),240);
  insert into public.lia_strategy_experiences(user_id,goal_key,strategy_key,outcome,score,context,context_key,evidence)
  values(p_user_id,left(trim(p_goal_key),160),left(trim(p_strategy_key),120),p_outcome,greatest(-100,least(100,p_score)),coalesce(p_context,'{}'::jsonb),nullif(v_context_key,''),coalesce(p_evidence,'[]'::jsonb))
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.lia_record_strategy_experience(uuid,text,text,text,integer,jsonb,jsonb) from public;
grant execute on function public.lia_record_strategy_experience(uuid,text,text,text,integer,jsonb,jsonb) to authenticated;

comment on column public.lia_strategy_experiences.context_key is 'Deterministic bounded context fingerprint; it affects ranking only and never grants authority.';
