create table if not exists public.lia_relational_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  signal text not null,
  value jsonb not null default '{}'::jsonb,
  source text not null default 'explicit_user_feedback' check (source = 'explicit_user_feedback'),
  created_at timestamptz not null default now()
);

create index if not exists idx_lia_relational_feedback_user_created
  on public.lia_relational_feedback(user_id, created_at desc);

alter table public.lia_relational_feedback enable row level security;

drop policy if exists lia_relational_feedback_owner on public.lia_relational_feedback;
create policy lia_relational_feedback_owner on public.lia_relational_feedback
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.lia_apply_relational_feedback(
  p_user_id uuid,
  p_signal text,
  p_value jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_preferences jsonb;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'forbidden';
  end if;

  if not exists (
    select 1 from lia_user_relationship_profiles
    where user_id = p_user_id and consented_personalization = true
  ) then
    return;
  end if;

  insert into lia_relational_feedback(user_id, signal, value)
  values (p_user_id, left(p_signal, 100), coalesce(p_value, '{}'::jsonb));

  select coalesce(learned_preferences, '{}'::jsonb)
    into current_preferences
  from lia_user_relationship_profiles
  where user_id = p_user_id
    and consented_personalization = true;

  update lia_user_relationship_profiles
  set learned_preferences = current_preferences || coalesce(p_value, '{}'::jsonb),
      interaction_summary = jsonb_set(
        coalesce(interaction_summary, '{}'::jsonb),
        '{last_explicit_feedback}',
        jsonb_build_object('signal', left(p_signal,100), 'at', now()),
        true
      ),
      updated_at = now()
  where user_id = p_user_id
    and consented_personalization = true;
end;
$$;

revoke all on function public.lia_apply_relational_feedback(uuid,text,jsonb) from public;
grant execute on function public.lia_apply_relational_feedback(uuid,text,jsonb) to authenticated;
