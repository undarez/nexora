-- v4.55: governed Use Case Engine.
-- A use case defines WHY/WHEN LIA orchestrates skills and tools. It never grants permissions.

create table if not exists public.lia_use_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  scope text not null default 'global' check (scope in ('global','user')),
  slug text not null,
  name text not null,
  description text not null,
  category text not null default 'general',
  objective text not null,
  trigger text not null,
  required_context jsonb not null default '[]'::jsonb,
  required_skills jsonb not null default '[]'::jsonb,
  suggested_tools jsonb not null default '[]'::jsonb,
  risk_class text not null default 'read' check (risk_class in ('read','recommendation','write-sensitive','critical')),
  minimum_autonomy integer not null default 0 check (minimum_autonomy between 0 and 8),
  human_approval_required boolean not null default false,
  success_criteria jsonb not null default '[]'::jsonb,
  verification_rules jsonb not null default '[]'::jsonb,
  status text not null default 'candidate' check (status in ('candidate','validated','active','deprecated','rejected')),
  source_type text not null check (source_type in ('system','user_provided','agent_generated','corrected')),
  trust_score integer not null default 0 check (trust_score between 0 and 100),
  use_count integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  version integer not null default 1 check (version > 0),
  content_hash text,
  last_validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(scope,user_id,slug)
);

create index if not exists idx_lia_use_cases_discovery
  on public.lia_use_cases(status,category,trust_score desc,updated_at desc);

alter table public.lia_use_cases enable row level security;
create policy "users read own use cases" on public.lia_use_cases
  for select to authenticated using (scope='global' or user_id=auth.uid());
revoke insert,update,delete on public.lia_use_cases from anon,authenticated;

-- Candidate creation is service-role only. The model can propose, never activate.
create or replace function public.lia_create_use_case_candidate(
  p_user_id uuid,
  p_scope text,
  p_slug text,
  p_name text,
  p_description text,
  p_category text,
  p_objective text,
  p_trigger text,
  p_required_context jsonb default '[]'::jsonb,
  p_required_skills jsonb default '[]'::jsonb,
  p_suggested_tools jsonb default '[]'::jsonb,
  p_risk_class text default 'read',
  p_minimum_autonomy integer default 0,
  p_human_approval_required boolean default false,
  p_success_criteria jsonb default '[]'::jsonb,
  p_verification_rules jsonb default '[]'::jsonb,
  p_source_type text default 'agent_generated',
  p_content_hash text default null
) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if p_scope not in ('global','user') then raise exception 'invalid_scope'; end if;
  if p_source_type not in ('system','user_provided','agent_generated','corrected') then raise exception 'invalid_source_type'; end if;
  if p_risk_class not in ('read','recommendation','write-sensitive','critical') then raise exception 'invalid_risk_class'; end if;
  if p_minimum_autonomy < 0 or p_minimum_autonomy > 8 then raise exception 'invalid_autonomy'; end if;
  if p_name is null or length(trim(p_name)) < 3 then raise exception 'use_case_name_too_short'; end if;
  if p_objective is null or length(trim(p_objective)) < 10 then raise exception 'use_case_objective_too_short'; end if;
  insert into public.lia_use_cases(
    user_id,scope,slug,name,description,category,objective,trigger,required_context,
    required_skills,suggested_tools,risk_class,minimum_autonomy,human_approval_required,
    success_criteria,verification_rules,status,source_type,trust_score,content_hash
  ) values (
    case when p_scope='user' then p_user_id else null end,p_scope,p_slug,p_name,p_description,p_category,p_objective,p_trigger,
    p_required_context,p_required_skills,p_suggested_tools,p_risk_class,p_minimum_autonomy,p_human_approval_required,
    p_success_criteria,p_verification_rules,'candidate',p_source_type,0,p_content_hash
  )
  on conflict(scope,user_id,slug) do update set
    name=excluded.name,description=excluded.description,category=excluded.category,objective=excluded.objective,
    trigger=excluded.trigger,required_context=excluded.required_context,required_skills=excluded.required_skills,
    suggested_tools=excluded.suggested_tools,risk_class=excluded.risk_class,minimum_autonomy=excluded.minimum_autonomy,
    human_approval_required=excluded.human_approval_required,success_criteria=excluded.success_criteria,
    verification_rules=excluded.verification_rules,source_type=excluded.source_type,content_hash=excluded.content_hash,
    updated_at=now()
  returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.lia_create_use_case_candidate(uuid,text,text,text,text,text,text,text,jsonb,jsonb,jsonb,text,integer,boolean,jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.lia_create_use_case_candidate(uuid,text,text,text,text,text,text,text,jsonb,jsonb,jsonb,text,integer,boolean,jsonb,jsonb,text,text) to service_role;

create or replace function public.lia_search_use_cases(
  p_user_id uuid,
  p_query text,
  p_category text default null,
  p_limit integer default 8
) returns table(
  use_case_id uuid,slug text,name text,description text,category text,objective text,trigger text,
  required_skills jsonb,suggested_tools jsonb,risk_class text,minimum_autonomy integer,
  human_approval_required boolean,success_criteria jsonb,verification_rules jsonb,status text,trust_score integer,version integer
)
language sql security definer set search_path=public,pg_temp as $$
  select id,slug,name,description,category,objective,trigger,required_skills,suggested_tools,risk_class,minimum_autonomy,
         human_approval_required,success_criteria,verification_rules,status,trust_score,version
  from public.lia_use_cases
  where (scope='global' or (scope='user' and user_id=p_user_id))
    and status in ('validated','active')
    and (p_category is null or category=p_category)
    and (coalesce(trim(p_query),'')='' or to_tsvector('simple',name||' '||description||' '||objective||' '||trigger) @@ plainto_tsquery('simple',p_query))
  order by case when status='active' then 0 else 1 end, trust_score desc, updated_at desc
  limit greatest(1,least(coalesce(p_limit,8),20));
$$;
revoke all on function public.lia_search_use_cases(uuid,text,text,integer) from public,anon;
grant execute on function public.lia_search_use_cases(uuid,text,text,integer) to authenticated,service_role;

create or replace function public.lia_validate_use_case(p_use_case_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u public.lia_use_cases%rowtype;
begin
  select * into u from public.lia_use_cases where id=p_use_case_id for update;
  if not found then raise exception 'use_case_not_found'; end if;
  if u.required_skills='[]'::jsonb or u.success_criteria='[]'::jsonb or u.verification_rules='[]'::jsonb then
    update public.lia_use_cases set status='rejected',updated_at=now() where id=u.id;
    return jsonb_build_object('validated',false,'reason','missing_operational_contract');
  end if;
  update public.lia_use_cases set status='validated',trust_score=greatest(trust_score,70),last_validated_at=now(),updated_at=now() where id=u.id;
  return jsonb_build_object('validated',true,'use_case_id',u.id);
end; $$;
revoke all on function public.lia_validate_use_case(uuid) from public,anon,authenticated;
grant execute on function public.lia_validate_use_case(uuid) to service_role;

create or replace function public.lia_activate_use_case(p_use_case_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u public.lia_use_cases%rowtype;
begin
  select * into u from public.lia_use_cases where id=p_use_case_id for update;
  if not found then raise exception 'use_case_not_found'; end if;
  if u.status <> 'validated' then raise exception 'use_case_not_validated'; end if;
  update public.lia_use_cases set status='active',updated_at=now() where id=u.id;
  return jsonb_build_object('active',true,'use_case_id',u.id);
end; $$;
revoke all on function public.lia_activate_use_case(uuid) from public,anon,authenticated;
grant execute on function public.lia_activate_use_case(uuid) to service_role;

create or replace function public.lia_record_use_case_outcome(
  p_use_case_id uuid,p_user_id uuid,p_success boolean,p_context jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.lia_use_cases set use_count=use_count+1,
    success_count=success_count+case when p_success then 1 else 0 end,
    failure_count=failure_count+case when p_success then 0 else 1 end,
    updated_at=now() where id=p_use_case_id;
end; $$;
revoke all on function public.lia_record_use_case_outcome(uuid,uuid,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.lia_record_use_case_outcome(uuid,uuid,boolean,jsonb) to service_role;

-- System use cases: discovery is automatic, permissions remain governed by the Policy Engine.
insert into public.lia_use_cases
(scope,slug,name,description,category,objective,trigger,required_context,required_skills,suggested_tools,risk_class,minimum_autonomy,human_approval_required,success_criteria,verification_rules,status,source_type,trust_score,version)
values
('global','affordability-check','Puis-je me permettre cet achat ?','Évaluer l’impact d’un achat important sur la trajectoire financière.','decision','Déterminer si un achat reste compatible avec la situation et les objectifs financiers.','L’utilisateur demande si un achat est financièrement soutenable.','["revenus","dépenses","épargne","budget","prévisions","objectifs"]','["financial-analysis","cashflow-analysis","scenario-analysis","risk-analysis"]','["get_financial_snapshot","get_budget_status","get_cashflow","get_forecast","save_financial_insight"]','recommendation',3,false,'["impact chiffré","scénarios comparés","risques explicités","recommandation vérifiée"]','["aucune donnée inventée","hypothèses séparées des faits","recalcul du scénario avant conclusion"]','active','system',95,1),
('global','month-review','Faire le point sur mon mois','Analyser la période, les écarts et les priorités.','pilotage','Comprendre ce qui s’est passé et identifier les prochaines actions utiles.','Fin de mois, demande utilisateur ou signal de dérive.','["transactions","budget","cashflow","prévisions"]','["budget-analysis","cashflow-analysis","variance-analysis","financial-coaching"]','["get_financial_snapshot","get_budget_status","get_cashflow","get_forecast","save_financial_insight"]','recommendation',3,false,'["écarts identifiés","causes proposées","priorités classées","résultat vérifié"]','["comparer prévu/réel","signaler les données manquantes","ne pas confondre corrélation et causalité"]','active','system',95,1),
('global','spending-drift','Détecter une dérive de dépenses','Identifier une accélération anormale ou un dépassement d’enveloppe.','alerts','Détecter tôt les dérives et proposer une réponse proportionnée.','Une transaction, une variation de rythme ou une alerte budgétaire.','["transactions","budget","calendrier","prévisions"]','["spending-detection","budget-analysis","anomaly-analysis"]','["search_transactions","get_budget_status","get_cashflow","save_financial_insight"]','recommendation',3,false,'["dérive quantifiée","référence explicitée","seuil justifié","proposition non destructive"]','["tenir compte de la progression du mois","éviter les faux positifs sur une dépense exceptionnelle"]','active','system',93,1),
('global','forecast-scenario','Simuler une décision financière','Comparer plusieurs trajectoires avant une décision.','simulation','Projeter l’effet d’une hypothèse sans modifier les données réelles.','L’utilisateur demande une simulation ou une projection.','["situation actuelle","prévisions","hypothèses","objectifs"]','["scenario-analysis","forecast-analysis","sensitivity-analysis"]','["get_financial_snapshot","get_forecast","get_cashflow","save_financial_insight"]','read',0,false,'["au moins deux scénarios","hypothèses explicites","incertitude signalée"]','["simulation séparée des données réelles","ne jamais enregistrer une hypothèse comme un fait"]','active','system',94,1),
('global','financial-learning','Apprendre d’une correction utilisateur','Transformer une correction validée en amélioration procédurale candidate.','learning','Améliorer les futures analyses sans modifier automatiquement les compétences actives.','L’utilisateur corrige une réponse ou une procédure.','["réponse initiale","correction","résultat"]','["error-analysis","skill-learning","verification"]','["search_skills","learn_skill"]','recommendation',1,false,'["cause identifiée","correction reproductible","candidate créé","activation bloquée jusqu’à validation"]','["ne jamais apprendre un secret","ne jamais transformer une permission en skill","exiger des preuves"]','active','system',98,1)
on conflict(scope,user_id,slug) do update set name=excluded.name,description=excluded.description,category=excluded.category,objective=excluded.objective,trigger=excluded.trigger,required_context=excluded.required_context,required_skills=excluded.required_skills,suggested_tools=excluded.suggested_tools,risk_class=excluded.risk_class,minimum_autonomy=excluded.minimum_autonomy,human_approval_required=excluded.human_approval_required,success_criteria=excluded.success_criteria,verification_rules=excluded.verification_rules,status='active',source_type='system',trust_score=excluded.trust_score,version=excluded.version,updated_at=now();


insert into public.lia_tool_policies(
  tool_key,
  risk_level,
  min_autonomy_level,
  human_approval_required,
  enabled
)
values
  ('search_use_cases', 'read', 0, false, true),
  ('learn_use_case', 'write', 1, false, true)
on conflict (tool_key) do update set
  risk_level = excluded.risk_level,
  min_autonomy_level = excluded.min_autonomy_level,
  human_approval_required = excluded.human_approval_required,
  enabled = true;