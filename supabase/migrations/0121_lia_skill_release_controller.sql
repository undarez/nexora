-- Chapter 8 P0: governed self-improvement release controller.
-- Candidate generation/evaluation may be autonomous; promotion never is.

create table if not exists public.lia_skill_release_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid not null references public.lia_skills(id) on delete cascade,
  baseline_version_id uuid references public.lia_skill_versions(id) on delete set null,
  candidate_version_id uuid references public.lia_skill_versions(id) on delete set null,
  lab_run_id uuid references public.lia_skill_lab_runs(id) on delete set null,
  review_board_id uuid references public.lia_learning_review_board(id) on delete set null,
  status text not null default 'human_review'
    check (status in ('blocked','human_review','canary','released','rolled_back','rejected')),
  baseline_score integer not null default 0 check (baseline_score between 0 and 100),
  candidate_score integer not null default 0 check (candidate_score between 0 and 100),
  score_delta integer not null default 0,
  regressions jsonb not null default '[]'::jsonb,
  gates jsonb not null default '{}'::jsonb,
  canary_started_at timestamptz,
  canary_ends_at timestamptz,
  released_at timestamptz,
  rolled_back_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lia_skill_release_candidates_user_time
  on public.lia_skill_release_candidates(user_id, created_at desc);
create index if not exists idx_lia_skill_release_candidates_status
  on public.lia_skill_release_candidates(status, created_at desc);

alter table public.lia_skill_release_candidates enable row level security;
drop policy if exists "lia skill release candidates own" on public.lia_skill_release_candidates;
create policy "lia skill release candidates own"
  on public.lia_skill_release_candidates
  for select to authenticated
  using (user_id = auth.uid());

create table if not exists public.lia_skill_release_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid not null references public.lia_skill_release_candidates(id) on delete cascade,
  action text not null check (action in ('created','review_started','canary_started','released','rolled_back','rejected')),
  actor_type text not null check (actor_type in ('system','human')),
  actor_user_id uuid references auth.users(id) on delete set null,
  reason text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_lia_skill_release_events_candidate_time
  on public.lia_skill_release_events(candidate_id, created_at desc);

alter table public.lia_skill_release_events enable row level security;
drop policy if exists "lia skill release events own" on public.lia_skill_release_events;
create policy "lia skill release events own"
  on public.lia_skill_release_events
  for select to authenticated
  using (user_id = auth.uid());

-- Human approval is the only path that can move a candidate into canary/released.
create or replace function public.lia_skill_release_transition(
  p_candidate_id uuid,
  p_action text,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c public.lia_skill_release_candidates;
  now_at timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select * into c
  from public.lia_skill_release_candidates
  where id = p_candidate_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'release_candidate_not_found';
  end if;

  if p_action = 'start_canary' then
    if c.status <> 'human_review' then raise exception 'candidate_not_in_human_review'; end if;
    if coalesce((c.gates->>'eligible_for_review')::boolean, false) is not true then raise exception 'release_gate_not_satisfied'; end if;
    if coalesce((c.gates->>'critical_failure')::boolean, true) is true then raise exception 'critical_gate_failed'; end if;
    if jsonb_array_length(coalesce(c.regressions, '[]'::jsonb)) > 0 then raise exception 'regressions_present'; end if;
    if c.candidate_score < c.baseline_score then raise exception 'candidate_score_below_baseline'; end if;

    update public.lia_skill_release_candidates
      set status='canary',
          canary_started_at=now_at,
          canary_ends_at=now_at + interval '24 hours',
          updated_at=now_at
    where id=c.id;

    insert into public.lia_skill_release_events(user_id,candidate_id,action,actor_type,actor_user_id,reason,evidence)
    values(auth.uid(),c.id,'canary_started','human',auth.uid(),p_reason,jsonb_build_object('baseline_score',c.baseline_score,'candidate_score',c.candidate_score,'canary_hours',24));

  elsif p_action = 'release' then
    if c.status <> 'canary' then raise exception 'candidate_not_in_canary'; end if;
    if c.canary_ends_at is null or c.canary_ends_at > now_at then raise exception 'canary_window_not_complete'; end if;
    if coalesce((c.gates->>'canary_healthy')::boolean, false) is not true then raise exception 'canary_health_not_confirmed'; end if;
    if c.candidate_version_id is null then raise exception 'candidate_version_missing'; end if;

    update public.lia_skills
      set active_version_id=c.candidate_version_id,
          status='active',
          updated_at=now_at
    where id=c.skill_id;

    update public.lia_skill_release_candidates
      set status='released', released_at=now_at, updated_at=now_at
    where id=c.id;

    insert into public.lia_skill_release_events(user_id,candidate_id,action,actor_type,actor_user_id,reason,evidence)
    values(auth.uid(),c.id,'released','human',auth.uid(),p_reason,jsonb_build_object('candidate_version_id',c.candidate_version_id));

  elsif p_action = 'rollback' then
    if c.status not in ('canary','released') then raise exception 'candidate_not_rollbackable'; end if;

    if c.baseline_version_id is not null then
      update public.lia_skills
        set active_version_id=c.baseline_version_id,
            status='active',
            updated_at=now_at
      where id=c.skill_id;
    end if;

    update public.lia_skill_release_candidates
      set status='rolled_back', rolled_back_at=now_at, updated_at=now_at,
          gates=jsonb_set(coalesce(gates,'{}'::jsonb), '{rollback_reason}', to_jsonb(coalesce(p_reason,'manual rollback')))
    where id=c.id;

    insert into public.lia_skill_release_events(user_id,candidate_id,action,actor_type,actor_user_id,reason,evidence)
    values(auth.uid(),c.id,'rolled_back','human',auth.uid(),p_reason,jsonb_build_object('baseline_version_id',c.baseline_version_id));

  elsif p_action = 'reject' then
    if c.status <> 'human_review' then raise exception 'candidate_not_in_human_review'; end if;

    update public.lia_skill_release_candidates
      set status='rejected', updated_at=now_at
    where id=c.id;

    insert into public.lia_skill_release_events(user_id,candidate_id,action,actor_type,actor_user_id,reason,evidence)
    values(auth.uid(),c.id,'rejected','human',auth.uid(),p_reason,'{}'::jsonb);

  else
    raise exception 'unsupported_release_action';
  end if;

  select * into c from public.lia_skill_release_candidates where id=p_candidate_id;
  return jsonb_build_object('id',c.id,'status',c.status,'canary_ends_at',c.canary_ends_at,'released_at',c.released_at,'rolled_back_at',c.rolled_back_at);
end;
$$;

revoke all on function public.lia_skill_release_transition(uuid,text,text) from public, anon;
grant execute on function public.lia_skill_release_transition(uuid,text,text) to authenticated;
