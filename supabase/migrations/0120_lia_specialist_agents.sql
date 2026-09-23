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
