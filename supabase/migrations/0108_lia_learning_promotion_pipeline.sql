-- V5.08.54: governed promotion pipeline.
-- A reviewed candidate may move candidate -> validated only after all deterministic gates pass.
-- Validation is NOT activation; activation remains a separate privileged operation.

alter table public.lia_learning_review_board
  drop constraint if exists lia_learning_review_board_status_check;

alter table public.lia_learning_review_board
  add constraint lia_learning_review_board_status_check
  check (status in ('pending','approved','rejected','replay_requested','promoted','promotion_blocked'));

alter table public.lia_learning_review_board
  add column if not exists promoted_by uuid null references auth.users(id) on delete set null,
  add column if not exists promoted_at timestamptz null,
  add column if not exists promotion_evidence jsonb not null default '{}'::jsonb;

create index if not exists idx_lia_learning_review_promotion
  on public.lia_learning_review_board(status, promoted_at desc);

create or replace function public.lia_promote_reviewed_skill(p_review_id uuid, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  r public.lia_learning_review_board%rowtype;
  s public.lia_skills%rowtype;
  v public.lia_skill_versions%rowtype;
  reasons jsonb := '[]'::jsonb;
begin
  select * into r from public.lia_learning_review_board where id=p_review_id for update;
  if not found then raise exception 'review_not_found'; end if;
  if r.status <> 'approved' then
    return jsonb_build_object('promoted',false,'reason','human_review_not_approved','skill_id',r.skill_id);
  end if;

  select * into s from public.lia_skills where id=r.skill_id for update;
  if not found then raise exception 'skill_not_found'; end if;
  select * into v from public.lia_skill_versions where skill_id=s.id order by version desc limit 1;
  if not found then raise exception 'skill_version_not_found'; end if;

  if r.verdict not in ('improved','no_regression') then reasons := reasons || '"replay_verdict_not_promotable"'::jsonb; end if;
  if r.candidate_score < 80 then reasons := reasons || '"candidate_score_below_threshold"'::jsonb; end if;
  if jsonb_array_length(coalesce(r.regressions,'[]'::jsonb)) > 0 then reasons := reasons || '"regressions_present"'::jsonb; end if;
  if coalesce((v.memory_gate->>'useful')::boolean,false) = false then reasons := reasons || '"memory_gate_useful_failed"'::jsonb; end if;
  if coalesce((v.memory_gate->>'reliable')::boolean,false) = false then reasons := reasons || '"memory_gate_reliable_failed"'::jsonb; end if;
  if coalesce((v.memory_gate->>'reproducible')::boolean,false) = false then reasons := reasons || '"memory_gate_reproducible_failed"'::jsonb; end if;
  if coalesce((v.memory_gate->>'obsolete')::boolean,false) = true then reasons := reasons || '"candidate_marked_obsolete"'::jsonb; end if;
  if s.status <> 'candidate' then reasons := reasons || '"skill_not_candidate"'::jsonb; end if;

  if jsonb_array_length(reasons) > 0 then
    update public.lia_learning_review_board
      set status='promotion_blocked', promotion_evidence=jsonb_build_object('reasons',reasons,'skill_version_id',v.id,'candidate_score',r.candidate_score,'verdict',r.verdict)
      where id=r.id;
    return jsonb_build_object('promoted',false,'skill_id',s.id,'reason','promotion_gate_failed','reasons',reasons);
  end if;

  update public.lia_skills
    set status='validated', trust_score=greatest(trust_score,70), last_validated_at=now(), updated_at=now()
    where id=s.id;

  insert into public.lia_skill_events(skill_id,skill_version_id,user_id,event,actor,context)
    values(s.id,v.id,s.user_id,'validated','admin',jsonb_build_object('promotion_review_id',r.id,'replay_run_id',r.replay_run_id,'candidate_score',r.candidate_score,'verdict',r.verdict,'p_actor',p_actor));

  update public.lia_learning_review_board
    set status='promoted', promoted_by=p_actor, promoted_at=now(), promotion_evidence=jsonb_build_object('skill_version_id',v.id,'candidate_score',r.candidate_score,'verdict',r.verdict,'activation_allowed',false)
    where id=r.id;

  return jsonb_build_object('promoted',true,'skill_id',s.id,'skill_version_id',v.id,'status','validated','activation_allowed',false);
end; $$;

revoke all on function public.lia_promote_reviewed_skill(uuid,uuid) from public,anon,authenticated;
grant execute on function public.lia_promote_reviewed_skill(uuid,uuid) to service_role;

comment on function public.lia_promote_reviewed_skill(uuid,uuid) is 'Promotes an approved learning candidate to validated only after replay and memory gates. Never activates the skill or changes model/policy/financial facts/permissions.';
