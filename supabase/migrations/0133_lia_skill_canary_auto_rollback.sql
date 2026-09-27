-- LIA canary safety: automatic rollback only after explicit observed failure.
-- No-observation / insufficient-evidence states never trigger rollback.
create or replace function public.lia_skill_canary_auto_rollback(
  p_candidate_id uuid,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  c public.lia_skill_release_candidates;
  g jsonb;
  should_rollback boolean := false;
  reason text := coalesce(nullif(trim(p_reason),''),'automatic_canary_failure');
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select * into c
  from public.lia_skill_release_candidates
  where id=p_candidate_id
  for update;
  if not found then raise exception 'release_candidate_not_found'; end if;
  if c.status <> 'canary' then raise exception 'candidate_not_in_canary'; end if;

  g := coalesce(c.gates,'{}'::jsonb);

  -- A canary must have produced evidence before it can be rolled back automatically.
  should_rollback :=
       coalesce((g->>'canary_observations')::integer,0) > 0
   and (
       coalesce((g->>'canary_critical_failure')::boolean,false)
       or coalesce((g->>'canary_failed_evaluations')::integer,0) > 0
       or (
         coalesce((g->>'canary_uses')::integer,0) >= 3
         and coalesce((g->>'canary_average_score')::integer,100000) < coalesce(c.baseline_score,0)
       )
   );

  if not should_rollback then
    return jsonb_build_object('rolled_back',false,'reason','rollback_threshold_not_reached');
  end if;

  if c.baseline_version_id is not null then
    update public.lia_skill_activations
      set status='rolled_back',
          rolled_back_by=null,
          rolled_back_at=now(),
          rollback_reason=reason
    where skill_id=c.skill_id and status='active';

    update public.lia_skills
      set active_version_id=c.baseline_version_id,
          status='active',
          updated_at=now()
    where id=c.skill_id;
  end if;

  update public.lia_skill_release_candidates
    set status='rolled_back',
        rolled_back_at=now(),
        updated_at=now(),
        gates=jsonb_set(g,'{automatic_rollback}',jsonb_build_object(
          'triggered',true,
          'reason',reason,
          'at',now()
        ))
  where id=c.id;

  insert into public.lia_skill_release_events(
    user_id,candidate_id,action,actor_type,actor_user_id,reason,evidence
  ) values(
    c.user_id,c.id,'rolled_back','system',null,reason,
    jsonb_build_object('automatic',true,'gates',g,'baseline_version_id',c.baseline_version_id)
  );

  return jsonb_build_object(
    'rolled_back',true,
    'candidate_id',c.id,
    'baseline_version_id',c.baseline_version_id,
    'reason',reason
  );
end;
$$;

revoke all on function public.lia_skill_canary_auto_rollback(uuid,text) from public,anon,authenticated;
grant execute on function public.lia_skill_canary_auto_rollback(uuid,text) to service_role;
