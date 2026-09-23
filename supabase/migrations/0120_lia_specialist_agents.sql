-- CHAPTER 7: specialist-agent registry and execution audit.
-- The database stores the governance/audit surface; actual agent capabilities remain in server code.

create table if not exists public.lia_specialist_agents (
  id text primary key,
  label text not null,
  purpose text not null,
  skills jsonb not null default '[]'::jsonb,
  permissions jsonb not null default '[]'::jsonb,
  autonomy_level integer not null default 2 check (autonomy_level between 0 and 8),
  max_steps integer not null default 5 check (max_steps between 1 and 50),
  max_retries_per_step integer not null default 2 check (max_retries_per_step between 0 and 10),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.lia_specialist_agents(id,label,purpose,skills,permissions,autonomy_level,max_steps,max_retries_per_step)
values
('copywriting','Copywriting','Créer et contrôler les contenus Nexora sans publication implicite.','["content-generation","ux-copy","email-copy"]','["content.read","content.write"]',2,4,2),
('seo','SEO','Auditer le SEO technique et éditorial.','["technical-seo","keyword-analysis","metadata"]','["seo.read","content.read"]',2,5,2),
('system-admin','System Admin','Diagnostiquer la santé technique avec des actions bornées.','["system-health","system-diagnostics","build-analysis"]','["system.read","system.write"]',2,6,2),
('data','Data Manager','Contrôler qualité, cohérence, doublons et anomalies.','["data-quality","data-deduplication","anomaly-detection"]','["data.read","data.write"]',2,6,2),
('finance','Finance','Analyser et piloter les données financières.','["finance-analytics","financial-reasoning","goal-lifecycle"]','["finance.read","finance.write"]',2,6,2),
('mobility','Mobility','Calculer les coûts de mobilité, carburant et trajets.','["mobility-fuel","mobility-profile"]','["mobility.read"]',2,4,2),
('research','Research','Rechercher et synthétiser avec gouvernance de sources.','["tavily-search","tavily-research","source-trust"]','["research.read"]',2,6,2)
on conflict (id) do update set
  label=excluded.label,
  purpose=excluded.purpose,
  skills=excluded.skills,
  permissions=excluded.permissions,
  autonomy_level=excluded.autonomy_level,
  max_steps=excluded.max_steps,
  max_retries_per_step=excluded.max_retries_per_step,
  updated_at=now();

alter table public.lia_specialist_agents enable row level security;
revoke all on public.lia_specialist_agents from public, anon, authenticated;

create table if not exists public.lia_specialist_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id text not null references public.lia_specialist_agents(id),
  request_id text,
  trigger_type text not null default 'user_request',
  objective text not null,
  status text not null check (status in ('planned','waiting_confirmation','running','completed','failed')),
  risk_class text not null check (risk_class in ('low','medium','high','critical')),
  confidence numeric(5,4) not null check (confidence >= 0 and confidence <= 1),
  requires_confirmation boolean not null default false,
  plan jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  verification jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_lia_specialist_runs_user_time on public.lia_specialist_runs(user_id, created_at desc);
create index if not exists idx_lia_specialist_runs_agent_time on public.lia_specialist_runs(agent_id, created_at desc);

alter table public.lia_specialist_runs enable row level security;
drop policy if exists "lia specialist runs own" on public.lia_specialist_runs;
create policy "lia specialist runs own" on public.lia_specialist_runs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());


-- Chapter 7 runtime hardening: every specialist run receives the same bounded
-- multidimensional autonomy envelope. Limits never grant permissions.
alter table public.lia_specialist_runs
  add column if not exists max_steps integer not null default 5 check (max_steps between 1 and 50),
  add column if not exists max_tool_calls integer not null default 8 check (max_tool_calls between 0 and 100),
  add column if not exists max_retries integer not null default 4 check (max_retries between 0 and 50),
  add column if not exists max_replans integer not null default 2 check (max_replans between 0 and 10),
  add column if not exists max_research_requests integer not null default 3 check (max_research_requests between 0 and 50),
  add column if not exists max_memory_writes integer not null default 5 check (max_memory_writes between 0 and 50),
  add column if not exists used_steps integer not null default 0,
  add column if not exists used_tool_calls integer not null default 0,
  add column if not exists used_retries integer not null default 0,
  add column if not exists used_replans integer not null default 0,
  add column if not exists used_research_requests integer not null default 0,
  add column if not exists used_memory_writes integer not null default 0;

create or replace function public.lia_consume_specialist_budget(
  p_run_id uuid, p_user_id uuid, p_dimension text, p_amount integer default 1
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare r public.lia_specialist_runs; used_value integer; max_value integer;
begin
  if p_amount < 1 then raise exception 'budget_amount_must_be_positive'; end if;
  select * into r from public.lia_specialist_runs where id=p_run_id and user_id=p_user_id for update;
  if not found then return jsonb_build_object('allowed',false,'reason','budget_not_initialized'); end if;
  used_value := case p_dimension
    when 'steps' then r.used_steps when 'tool_calls' then r.used_tool_calls when 'retries' then r.used_retries
    when 'replans' then r.used_replans when 'research_requests' then r.used_research_requests
    when 'memory_writes' then r.used_memory_writes else -1 end;
  max_value := case p_dimension
    when 'steps' then r.max_steps when 'tool_calls' then r.max_tool_calls when 'retries' then r.max_retries
    when 'replans' then r.max_replans when 'research_requests' then r.max_research_requests
    when 'memory_writes' then r.max_memory_writes else -1 end;
  if used_value < 0 or max_value < 0 then return jsonb_build_object('allowed',false,'reason','unknown_budget_dimension','dimension',p_dimension); end if;
  if used_value + p_amount > max_value then return jsonb_build_object('allowed',false,'reason','budget_exhausted','dimension',p_dimension,'used',used_value,'limit',max_value,'requested',p_amount); end if;
  if p_dimension='steps' then r.used_steps:=r.used_steps+p_amount;
  elsif p_dimension='tool_calls' then r.used_tool_calls:=r.used_tool_calls+p_amount;
  elsif p_dimension='retries' then r.used_retries:=r.used_retries+p_amount;
  elsif p_dimension='replans' then r.used_replans:=r.used_replans+p_amount;
  elsif p_dimension='research_requests' then r.used_research_requests:=r.used_research_requests+p_amount;
  elsif p_dimension='memory_writes' then r.used_memory_writes:=r.used_memory_writes+p_amount;
  end if;
  update public.lia_specialist_runs set
    used_steps=r.used_steps, used_tool_calls=r.used_tool_calls, used_retries=r.used_retries,
    used_replans=r.used_replans, used_research_requests=r.used_research_requests,
    used_memory_writes=r.used_memory_writes
  where id=p_run_id;
  return jsonb_build_object('allowed',true,'dimension',p_dimension,'used',used_value+p_amount,'limit',max_value,'remaining',max_value-used_value-p_amount);
end;
$$;

revoke all on function public.lia_consume_specialist_budget(uuid,uuid,text,integer) from public, anon, authenticated;
grant execute on function public.lia_consume_specialist_budget(uuid,uuid,text,integer) to service_role;
