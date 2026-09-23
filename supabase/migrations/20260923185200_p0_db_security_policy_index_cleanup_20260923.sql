-- P0 security/performance follow-up: remove redundant RLS policies and indexes,
-- and make remaining SECURITY DEFINER functions safe with search_path=''.

create or replace function public.lia_get_relational_context(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare result jsonb;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'profile', coalesce((select jsonb_build_object('display_name',p.display_name,'currency',p.currency,'assistant_style',p.assistant_style,'financial_goal',p.financial_goal) from public.profiles p where p.id=p_user_id),'{}'::jsonb),
    'relationship', coalesce((select jsonb_build_object('relationship_mode',r.relationship_mode,'preferred_tone',r.preferred_tone,'detail_level',r.detail_level,'initiative_level',r.initiative_level,'financial_coaching_style',r.financial_coaching_style,'goal_context',r.goal_context,'learned_preferences',r.learned_preferences,'interaction_summary',r.interaction_summary,'consented_personalization',r.consented_personalization) from public.lia_user_relationship_profiles r where r.user_id=p_user_id and r.consented_personalization=true),jsonb_build_object('consented_personalization',false)),
    'cognitive', coalesce((select jsonb_build_object('understanding_score',c.understanding_score,'reasoning_score',c.reasoning_score,'knowledge_score',c.knowledge_score,'planning_score',c.planning_score,'problem_solving_score',c.problem_solving_score,'tool_use_score',c.tool_use_score,'research_score',c.research_score,'verification_score',c.verification_score,'metacognition_score',c.metacognition_score,'memory_score',c.memory_score,'learning_score',c.learning_score,'autonomy_score',c.autonomy_score,'safety_score',c.safety_score,'autonomy_level',c.autonomy_level) from public.lia_cognitive_profiles c where c.user_id=p_user_id),'{}'::jsonb),
    'autonomy', coalesce((select jsonb_build_object('max_autonomy_level',a.max_autonomy_level) from public.lia_autonomy_profiles a where a.user_id=p_user_id),'{}'::jsonb),
    'agentic_principles', coalesce((select jsonb_agg(jsonb_build_object('slug',c.slug,'name',c.name,'category',c.category,'description',c.description)) from public.lia_agentic_concepts c where c.status='active'),'[]'::jsonb)
  ) into result;
  return result;
end;
$function$;

create or replace function public.verify_lia_governance_audit(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare r record; prev text:=null; expected text; payload text; checked integer:=0; ok boolean:=true;
begin
 if p_user_id<>auth.uid() then raise exception 'forbidden'; end if;
 for r in select * from public.lia_governance_audit where user_id=p_user_id order by created_at asc,id asc loop
  payload:=coalesce(prev,'')||'|'||r.id::text||'|'||r.user_id::text||'|'||r.event_type||'|'||r.actor||'|'||coalesce(r.correlation_id,'')||'|'||coalesce(r.source_refs,'{}'::jsonb)::text||'|'||coalesce(r.metadata,'{}'::jsonb)::text||'|'||r.created_at::text;
  expected:=encode(extensions.digest(payload,'sha256'),'hex');
  if r.previous_hash is distinct from prev or r.event_hash is distinct from expected then ok:=false; exit; end if;
  prev:=r.event_hash; checked:=checked+1;
 end loop;
 return jsonb_build_object('valid',ok,'checked',checked,'last_hash',prev);
end;
$function$;

drop policy if exists business_profiles_select_member on public.business_profiles;
drop policy if exists financial_workspace_members_select_self on public.financial_workspace_members;
drop policy if exists financial_workspaces_select_member on public.financial_workspaces;
drop policy if exists "knowledge items readable" on public.knowledge_items;
drop policy if exists "knowledge sources readable" on public.knowledge_sources;

drop index if exists public.business_profiles_siret_idx;
drop index if exists public.financial_workspace_member_user_idx;
drop index if exists public.idx_lia_action_proposals_lifecycle;
drop index if exists public.idx_lia_memory_curation_user_created;
drop index if exists public.lia_orchestration_steps_run_index_idx;
drop index if exists public.lia_supervisor_runs_user_created_idx;
