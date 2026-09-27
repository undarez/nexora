-- LIA bounded autonomy: defense-in-depth alignment for autonomous learning.
-- L7 is the minimum runtime policy for durable use-case/skill learning.
-- This does not restrict observation, research, reasoning, replanning, or low-risk execution.

update public.lia_tool_policies
set min_autonomy_level = 7
where tool_key in ('learn_use_case','learn_skill');

-- Release remains a human control-plane operation. Before activation/release,
-- require the exact candidate version to satisfy the durable-memory gate and
-- to have an explicit promoted review-board record.
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
  v public.lia_skill_versions;
  now_at timestamptz := now();
  promoted boolean := false;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;

  select * into c
  from public.lia_skill_release_candidates
  where id = p_candidate_id and user_id = auth.uid()
  for update;
  if not found then raise exception 'release_candidate_not_found'; end if;

  if p_action = 'start_canary' then
    if c.status <> 'human_review' then raise exception 'candidate_not_in_human_review'; end if;
    if coalesce((c.gates->>'eligible_for_review')::boolean, false) is not true then raise exception 'release_gate_not_satisfied'; end if;
    if coalesce((c.gates->>'critical_failure')::boolean, true) is true then raise exception 'critical_gate_failed'; end if;
    if jsonb_array_length(coalesce(c.regressions, '[]'::jsonb)) > 0 then raise exception 'regressions_present'; end if;
    if c.candidate_score < c.baseline_score then raise exception 'candidate_score_below_baseline'; end if;

    update public.lia_skill_release_candidates
      set status='canary', canary_started_at=now_at,
          canary_ends_at=now_at + interval '24 hours', updated_at=now_at
    where id=c.id;

    insert into public.lia_skill_release_events(user_id,candidate_id,action,actor_type,actor_user_id,reason,evidence)
    values(auth.uid(),c.id,'canary_started','human',auth.uid(),p_reason,
      jsonb_build_object('baseline_score',c.baseline_score,'candidate_score',c.candidate_score,'canary_hours',24));

  elsif p_action = 'release' then
    if c.status <> 'canary' then raise exception 'candidate_not_in_canary'; end if;
    if c.canary_ends_at is null or c.canary_ends_at > now_at then raise exception 'canary_window_not_complete'; end if;
    if coalesce((c.gates->>'canary_healthy')::boolean, false) is not true then raise exception 'canary_health_not_confirmed'; end if;
    if c.candidate_version_id is null then raise exception 'candidate_version_missing'; end if;

    select * into v from public.lia_skill_versions where id=c.candidate_version_id;
    if not found then raise exception 'candidate_version_missing'; end if;

    if coalesce((v.memory_gate->>'useful')::boolean,false) is not true
       or coalesce((v.memory_gate->>'reliable')::boolean,false) is not true
       or coalesce((v.memory_gate->>'reproducible')::boolean,false) is not true
       or coalesce((v.memory_gate->>'obsolete')::boolean,false) is true then
      raise exception 'memory_gate_failed';
    end if;

    select exists(
      select 1 from public.lia_learning_review_board b
      where b.skill_id=c.skill_id
        and b.skill_version_id=c.candidate_version_id
        and b.status='promoted'
    ) into promoted;
    if not promoted then raise exception 'governed_promotion_missing'; end if;

    -- Close the previous activation before inserting the new one so the
    -- one-active-version unique index can never be violated.
    update public.lia_skill_activations
      set status='rolled_back', rolled_back_by=auth.uid(), rolled_back_at=now_at,
          rollback_reason='superseded_by_governed_release'
    where skill_id=c.skill_id and status='active';

    insert into public.lia_skill_activations(skill_id,version_id,previous_version_id,activated_by,activation_reason)
      values(c.skill_id,c.candidate_version_id,null,auth.uid(),
             coalesce(trim(p_reason),'Governed release after completed canary and promoted review.'));

    update public.lia_skills
      set active_version_id=c.candidate_version_id, status='active', updated_at=now_at
    where id=c.skill_id;

    update public.lia_skill_release_candidates
      set status='released', released_at=now_at, updated_at=now_at
    where id=c.id;

    insert into public.lia_skill_release_events(user_id,candidate_id,action,actor_type,actor_user_id,reason,evidence)
    values(auth.uid(),c.id,'released','human',auth.uid(),p_reason,
      jsonb_build_object('candidate_version_id',c.candidate_version_id,'governed_promotion',true,'memory_gate',v.memory_gate));

  elsif p_action = 'rollback' then
    if c.status not in ('canary','released') then raise exception 'candidate_not_rollbackable'; end if;

    if c.baseline_version_id is not null then
      update public.lia_skills
        set active_version_id=c.baseline_version_id, status='active', updated_at=now_at
      where id=c.skill_id;
    else
      update public.lia_skills
        set active_version_id=null, status='validated', updated_at=now_at
      where id=c.skill_id;
    end if;

    update public.lia_skill_release_candidates
      set status='rolled_back', rolled_back_at=now_at, updated_at=now_at,
          gates=jsonb_set(coalesce(gates,'{}'::jsonb), '{rollback_reason}', to_jsonb(coalesce(p_reason,'manual rollback')))
    where id=c.id;

    insert into public.lia_skill_release_events(user_id,candidate_id,action,actor_type,actor_user_id,reason,evidence)
    values(auth.uid(),c.id,'rolled_back','human',auth.uid(),p_reason,
      jsonb_build_object('baseline_version_id',c.baseline_version_id));

  elsif p_action = 'reject' then
    if c.status <> 'human_review' then raise exception 'candidate_not_in_human_review'; end if;

    update public.lia_skill_release_candidates set status='rejected', updated_at=now_at where id=c.id;

    insert into public.lia_skill_release_events(user_id,candidate_id,action,actor_type,actor_user_id,reason,evidence)
    values(auth.uid(),c.id,'rejected','human',auth.uid(),p_reason,'{}'::jsonb);

  else
    raise exception 'unsupported_release_action';
  end if;

  select * into c from public.lia_skill_release_candidates where id=p_candidate_id;
  return jsonb_build_object('id',c.id,'status',c.status,'canary_ends_at',c.canary_ends_at,
    'released_at',c.released_at,'rolled_back_at',c.rolled_back_at);
end;
$$;

revoke all on function public.lia_skill_release_transition(uuid,text,text) from public, anon;
grant execute on function public.lia_skill_release_transition(uuid,text,text) to authenticated;
