-- NEXORA v5.06.14: Financial Agent Memory Pipeline v2 reconciliation.
-- Additive only. Reuses existing LIA memory, agent-loop, knowledge and authorization layers.
-- Knowledge NEVER grants authorization.
create extension if not exists pgcrypto;

create table if not exists public.financial_memory_versions (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.lia_memory(id) on delete cascade,
  version integer not null,
  content_hash text not null,
  content_snapshot jsonb not null,
  status text not null check (status in ('proposed','validated','deprecated','conflicted','quarantined')),
  source_reason text,
  changed_by text,
  created_at timestamptz not null default now(),
  unique(memory_id, version),
  unique(memory_id, content_hash)
);

create table if not exists public.financial_memory_integrity_events (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid references public.lia_memory(id) on delete set null,
  expected_hash text,
  observed_hash text,
  event_type text not null check (event_type in ('mutation','drift','rollback','quarantine','integrity_check')),
  severity text not null default 'warning' check (severity in ('info','warning','high','critical')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.financial_memory_mutations (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid references public.lia_memory(id) on delete set null,
  previous_version_id uuid references public.financial_memory_versions(id) on delete set null,
  new_version_id uuid references public.financial_memory_versions(id) on delete set null,
  mutation_type text not null,
  reason text,
  actor_type text not null default 'system',
  actor_id text,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_decision_gates (
  id uuid primary key default gen_random_uuid(),
  agent_loop_run_id uuid references public.agent_loop_runs(id) on delete set null,
  agent_loop_step_id uuid references public.agent_loop_steps(id) on delete set null,
  action_type text not null,
  risk_level text not null check (risk_level in ('low','medium','high','critical')),
  reversible boolean not null default true,
  amount numeric,
  currency text,
  authorization_present boolean not null default false,
  policy_id text,
  outcome text not null check (outcome in ('ALLOW','ALLOW_WITH_GUARDRAIL','REQUIRE_APPROVAL','ESCALATE','BLOCK')),
  rationale jsonb not null default '{}'::jsonb,
  knowledge_ids uuid[] not null default '{}',
  evidence_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_agent_decision_gates_run on public.agent_decision_gates(agent_loop_run_id, created_at desc);

create table if not exists public.agent_behaviour_events (
  id uuid primary key default gen_random_uuid(),
  agent_loop_run_id uuid references public.agent_loop_runs(id) on delete set null,
  agent_loop_step_id uuid references public.agent_loop_steps(id) on delete set null,
  event_type text not null check (event_type in ('tool_call','tool_failure','retry','policy_block','approval_request','memory_mutation','drift','evidence_mismatch','decision_reversal')),
  severity text not null check (severity in ('info','warning','high','critical')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_agent_behaviour_events_run on public.agent_behaviour_events(agent_loop_run_id, created_at desc);

create table if not exists public.financial_agent_drift_signals (
  id uuid primary key default gen_random_uuid(),
  agent_id text,
  metric_name text not null,
  baseline_value numeric,
  observed_value numeric,
  drift_score numeric,
  threshold numeric,
  status text not null default 'open' check (status in ('open','reviewed','dismissed','resolved')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_financial_agent_drift_signals_status on public.financial_agent_drift_signals(status, created_at desc);

alter table public.financial_memory_versions enable row level security;
alter table public.financial_memory_integrity_events enable row level security;
alter table public.financial_memory_mutations enable row level security;
alter table public.agent_decision_gates enable row level security;
alter table public.agent_behaviour_events enable row level security;
alter table public.financial_agent_drift_signals enable row level security;

revoke all on public.financial_memory_versions from anon, authenticated;
revoke all on public.financial_memory_integrity_events from anon, authenticated;
revoke all on public.financial_memory_mutations from anon, authenticated;
revoke all on public.agent_decision_gates from anon, authenticated;
revoke all on public.agent_behaviour_events from anon, authenticated;
revoke all on public.financial_agent_drift_signals from anon, authenticated;

create or replace function public.financial_memory_last_validated_version(p_memory_id uuid)
returns public.financial_memory_versions
language sql stable security definer set search_path=public,pg_temp
as $$
  select * from public.financial_memory_versions
  where memory_id=p_memory_id and status='validated'
  order by version desc limit 1;
$$;

create or replace function public.record_agent_behaviour_event(
  p_run_id uuid, p_step_id uuid, p_event_type text, p_severity text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  if p_event_type not in ('tool_call','tool_failure','retry','policy_block','approval_request','memory_mutation','drift','evidence_mismatch','decision_reversal')
     or p_severity not in ('info','warning','high','critical') then
    raise exception 'invalid behaviour event';
  end if;
  insert into public.agent_behaviour_events(agent_loop_run_id,agent_loop_step_id,event_type,severity,metadata)
  values(p_run_id,p_step_id,p_event_type,p_severity,coalesce(p_metadata,'{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.record_agent_decision_gate(
  p_run_id uuid, p_step_id uuid, p_action_type text, p_risk_level text,
  p_reversible boolean, p_authorization_present boolean, p_policy_id text default null,
  p_amount numeric default null, p_currency text default 'EUR',
  p_knowledge_ids uuid[] default '{}', p_evidence_ids uuid[] default '{}',
  p_rationale jsonb default '{}'::jsonb
)
returns table(id uuid, outcome text)
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_outcome text;
declare v_id uuid;
begin
  if p_authorization_present is not true then v_outcome := 'BLOCK';
  elsif p_risk_level='critical' then v_outcome := 'REQUIRE_APPROVAL';
  elsif p_risk_level='high' and p_reversible=false then v_outcome := 'REQUIRE_APPROVAL';
  elsif p_risk_level='high' then v_outcome := 'ALLOW_WITH_GUARDRAIL';
  else v_outcome := 'ALLOW';
  end if;
  insert into public.agent_decision_gates(
    agent_loop_run_id,agent_loop_step_id,action_type,risk_level,reversible,amount,currency,
    authorization_present,policy_id,outcome,rationale,knowledge_ids,evidence_ids
  ) values(
    p_run_id,p_step_id,p_action_type,p_risk_level,coalesce(p_reversible,true),p_amount,coalesce(p_currency,'EUR'),
    coalesce(p_authorization_present,false),p_policy_id,v_outcome,
    coalesce(p_rationale,'{}'::jsonb)||jsonb_build_object('knowledge_is_not_authorization',true),
    coalesce(p_knowledge_ids,'{}'),coalesce(p_evidence_ids,'{}')
  ) returning agent_decision_gates.id into v_id;
  return query select v_id,v_outcome;
end;
$$;

create or replace function public.version_lia_memory(
  p_memory_id uuid, p_content jsonb, p_status text default 'proposed',
  p_reason text default null, p_changed_by text default 'system'
)
returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_version integer;
declare v_prev uuid;
declare v_new uuid;
declare v_hash text;
begin
  if p_status not in ('proposed','validated','deprecated','conflicted','quarantined') then
    raise exception 'invalid memory status';
  end if;
  select coalesce(max(version),0)+1 into v_version from public.financial_memory_versions where memory_id=p_memory_id;
  select id into v_prev from public.financial_memory_versions where memory_id=p_memory_id order by version desc limit 1;
  v_hash := encode(digest(convert_to(p_content::text,'utf8'),'sha256'),'hex');
  insert into public.financial_memory_versions(memory_id,version,content_hash,content_snapshot,status,source_reason,changed_by)
  values(p_memory_id,v_version,v_hash,p_content,p_status,p_reason,p_changed_by)
  returning id into v_new;
  insert into public.financial_memory_mutations(memory_id,previous_version_id,new_version_id,mutation_type,reason,actor_type,actor_id,approved)
  values(p_memory_id,v_prev,v_new,'version_created',p_reason,'system',p_changed_by,p_status='validated');
  perform public.record_agent_behaviour_event(null,null,'memory_mutation','info',jsonb_build_object('memory_id',p_memory_id,'version',v_version,'status',p_status));
  return v_new;
end;
$$;

create or replace function public.rollback_lia_memory_to_last_validated(p_memory_id uuid, p_changed_by text default 'system')
returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_source public.financial_memory_versions;
declare v_new uuid;
begin
  select * into v_source from public.financial_memory_last_validated_version(p_memory_id);
  if v_source.id is null then raise exception 'no_validated_memory_version'; end if;
  v_new := public.version_lia_memory(p_memory_id,v_source.content_snapshot,'validated','rollback_to_last_validated',p_changed_by);
  insert into public.financial_memory_integrity_events(memory_id,expected_hash,observed_hash,event_type,severity,details)
  values(p_memory_id,v_source.content_hash,v_source.content_hash,'rollback','warning',jsonb_build_object('restored_version_id',v_source.id,'new_version_id',v_new));
  return v_new;
end;
$$;

grant execute on function public.financial_memory_last_validated_version(uuid) to service_role;
grant execute on function public.record_agent_behaviour_event(uuid,uuid,text,text,jsonb) to service_role;
grant execute on function public.record_agent_decision_gate(uuid,uuid,text,text,boolean,boolean,text,numeric,text,uuid[],uuid[],jsonb) to service_role;
grant execute on function public.version_lia_memory(uuid,jsonb,text,text,text) to service_role;
grant execute on function public.rollback_lia_memory_to_last_validated(uuid,text) to service_role;
