-- NEXORA P0 DB security hardening
-- Applied to production project budgetlink on 2026-09-23.
--
-- Goals:
-- 1. Pin exposed SECURITY DEFINER functions to an empty search_path.
-- 2. Fully qualify application objects in functions that previously relied on public search_path.
-- 3. Prevent future automatic EXECUTE grants on public functions.
--
-- Existing authenticated EXECUTE grants are intentionally retained for user-facing RPCs.
-- These RPCs enforce auth.uid() ownership checks in their function bodies.

create or replace function public.lia_apply_relational_feedback(
  p_user_id uuid, p_signal text, p_value jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare current_preferences jsonb;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'forbidden'; end if;
  if not exists (
    select 1 from public.lia_user_relationship_profiles
    where user_id=p_user_id and consented_personalization=true
  ) then return; end if;
  insert into public.lia_relational_feedback(user_id,signal,value)
    values(p_user_id,left(p_signal,100),coalesce(p_value,'{}'::jsonb));
  select coalesce(learned_preferences,'{}'::jsonb)
    into current_preferences
    from public.lia_user_relationship_profiles
    where user_id=p_user_id and consented_personalization=true;
  update public.lia_user_relationship_profiles
    set learned_preferences=current_preferences || coalesce(p_value,'{}'::jsonb),
        interaction_summary=jsonb_set(
          coalesce(interaction_summary,'{}'::jsonb),
          '{last_explicit_feedback}',
          jsonb_build_object('signal',left(p_signal,100),'at',now()),true
        ),
        updated_at=now()
    where user_id=p_user_id and consented_personalization=true;
end;
$function$;

create or replace function public.lia_record_decision(
  p_user_id uuid, p_procedure_id uuid, p_objective text, p_context jsonb,
  p_decision jsonb, p_risk_class text, p_autonomy_level integer,
  p_human_gate_required boolean, p_status text, p_reason text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare rid uuid; max_level integer;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'forbidden'; end if;
  select coalesce(max_autonomy_level,0) into max_level
    from public.lia_autonomy_profiles where user_id=p_user_id;
  max_level := coalesce(max_level,0);
  insert into public.lia_decision_records(
    user_id,procedure_id,objective,context,decision,risk_class,autonomy_level,
    max_autonomy_level,human_gate_required,status,reason
  ) values(
    p_user_id,p_procedure_id,p_objective,coalesce(p_context,'{}'),
    coalesce(p_decision,'{}'),p_risk_class,p_autonomy_level,max_level,
    p_human_gate_required,p_status,p_reason
  ) returning id into rid;
  return rid;
end;
$function$;

create or replace function public.lia_record_relational_signal(
  p_user_id uuid, p_signal text, p_value jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare current_summary jsonb; new_summary jsonb;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'forbidden'; end if;
  select coalesce(interaction_summary, '{}'::jsonb)
    into current_summary
    from public.lia_user_relationship_profiles
    where user_id=p_user_id and consented_personalization=true;
  if current_summary is null then return; end if;
  new_summary := jsonb_set(
    current_summary,'{signals}',
    coalesce(current_summary->'signals','[]'::jsonb) ||
      jsonb_build_array(jsonb_build_object('signal',p_signal,'value',p_value,'at',now())),true
  );
  update public.lia_user_relationship_profiles
    set interaction_summary=new_summary, updated_at=now()
    where user_id=p_user_id and consented_personalization=true;
end;
$function$;

create or replace function public.lia_select_procedure(
  p_user_id uuid, p_objective text, p_required_category text default null,
  p_requested_risk text default 'read'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare proc jsonb;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'id',id,'slug',slug,'name',name,'description',description,
    'category',category,'trigger_conditions',trigger_conditions,'steps',steps,
    'verification_rules',verification_rules,'failure_modes',failure_modes,
    'risk_class',risk_class,'minimum_autonomy',minimum_autonomy,
    'human_approval_required',human_approval_required,'version',version
  ) into proc
  from public.lia_procedures
  where status in ('validated','active')
    and (p_required_category is null or category = p_required_category)
    and case p_requested_risk
      when 'critical' then risk_class='critical'
      when 'write-sensitive' then risk_class in ('write-sensitive','critical')
      when 'recommendation' then risk_class in ('recommendation','write-sensitive','critical')
      else risk_class in ('read','recommendation','write-sensitive','critical')
    end
  order by case when lower(p_objective) like '%'||lower(name)||'%' then 0 else 1 end,
           minimum_autonomy asc, version desc
  limit 1;
  return coalesce(proc,'{}'::jsonb);
end;
$function$;

alter function public.append_lia_governance_audit(uuid,text,text,text,jsonb,jsonb) set search_path = '';
alter function public.approve_lia_action(uuid,text) set search_path = '';
alter function public.claim_lia_action_for_execution(uuid) set search_path = '';
alter function public.get_lia_autonomy(uuid) set search_path = '';
alter function public.lia_create_cron_job(uuid,text,text,text,jsonb) set search_path = '';
alter function public.lia_get_relational_context(uuid) set search_path = '';
alter function public.lia_record_strategy_experience(uuid,text,text,text,integer,jsonb,jsonb) set search_path = '';
alter function public.lia_search_skills(uuid,text,text,integer) set search_path = '';
alter function public.lia_search_use_cases(uuid,text,text,integer) set search_path = '';
alter function public.lia_stop_loop(uuid,uuid) set search_path = '';
alter function public.lia_supervisor_record_run(uuid,text,text,jsonb,jsonb,integer) set search_path = '';
alter function public.lia_touch_cognitive_session(uuid,uuid,uuid,text,text) set search_path = '';
alter function public.publish_financial_watch_notifications(uuid,jsonb) set search_path = '';
alter function public.refresh_financial_notifications(uuid) set search_path = '';
alter function public.search_financial_knowledge(text,text,integer,numeric) set search_path = '';
alter function public.set_lia_autonomy(uuid,integer) set search_path = '';
alter function public.verify_lia_governance_audit(uuid) set search_path = '';

alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema public revoke execute on functions from authenticated;
