create table if not exists public.lia_procedures (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  category text not null,
  trigger_conditions jsonb not null default '{}'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  verification_rules jsonb not null default '[]'::jsonb,
  failure_modes jsonb not null default '[]'::jsonb,
  risk_class text not null default 'read' check (risk_class in ('read','recommendation','write-sensitive','critical')),
  minimum_autonomy integer not null default 0 check (minimum_autonomy between 0 and 8),
  human_approval_required boolean not null default false,
  status text not null default 'active' check (status in ('candidate','validated','active','deprecated')),
  source_kind text not null default 'internal',
  source_ref text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lia_procedures_category on public.lia_procedures(category);
create index if not exists idx_lia_procedures_status on public.lia_procedures(status);

alter table public.lia_procedures enable row level security;
drop policy if exists lia_procedures_read on public.lia_procedures;
create policy lia_procedures_read on public.lia_procedures for select to authenticated using (status in ('validated','active'));

insert into public.lia_procedures (slug,name,description,category,trigger_conditions,steps,verification_rules,failure_modes,risk_class,minimum_autonomy,human_approval_required,source_kind,source_ref)
values
('financial_snapshot_review','Revue de situation financière','Construire une photographie factuelle avant toute recommandation.',
 '{"requires":"financial_context"}',
 '["charger les comptes et transactions","calculer les soldes et flux","identifier les données manquantes","séparer faits et hypothèses"]',
 '["les calculs proviennent des données déterministes","aucune écriture financière n''est effectuée","les données manquantes sont signalées"]',
 '["données incomplètes","période incohérente","erreur de calcul"]','read',0,false,'internal','NEXORA procedure baseline'),
('budget_health_check','Contrôle de santé du budget','Évaluer le budget mensuel et les enveloppes avant de proposer une optimisation.',
 '{"requires":"budget_context"}',
 '["charger budget et enveloppes","rapprocher dépenses observées","calculer restant et taux d''utilisation","repérer dépassements et marges","prioriser les écarts"]',
 '["dépenses observées séparées des prévisions","aucune dépense inventée","totaux cohérents avec les données source"]',
 '["enveloppe absente","transaction non catégorisée","budget non disponible"]','recommendation',1,false,'internal','NEXORA procedure baseline'),
('research_and_verify','Recherche et vérification','Rechercher une information externe, comparer les preuves et conserver uniquement les conclusions suffisamment corroborées.',
 '{"requires":"external_information"}',
 '["définir la question","identifier les lacunes","rechercher des sources de confiance","comparer les affirmations","chercher les contradictions","produire une conclusion bornée"]',
 '["sources autorisées","provenance conservée","contradictions signalées","aucune action financière directe"]',
 '["sources insuffisantes","contradiction non résolue","source non fiable"]','recommendation',1,false,'internal','NEXORA procedure baseline'),
('human_gate_sensitive_action','Validation humaine pour action sensible','Préparer une action sensible sans l''exécuter tant que la validation humaine n''est pas obtenue.',
 '{"risk_class":"write-sensitive"}',
 '["décrire l''action","présenter l''impact","présenter les données utilisées","demander validation explicite","exécuter uniquement après validation","observer le résultat"]',
 '["validation explicite présente","impact prévisualisé","action conforme aux politiques","résultat observé"]',
 '["validation absente","politique incompatible","résultat inattendu"]','write-sensitive',3,true,'internal','NEXORA Human Gate'),
('relational_adaptation','Adaptation relationnelle','Adapter la communication et le niveau d''initiative au profil relationnel consenti sans modifier les garde-fous.',
 '{"requires":"relational_context"}',
 '["charger le contexte relationnel","appliquer ton et niveau de détail","adapter initiative et coaching","vérifier que les contraintes de sécurité restent inchangées"]',
 '["personnalisation consentie","aucune permission modifiée","aucun garde-fou modifié"]',
 '["consentement absent","préférence ambiguë","conflit avec une contrainte de sécurité"]','read',0,false,'internal','NEXORA relational architecture')
on conflict (slug) do update set name=excluded.name,description=excluded.description,category=excluded.category,trigger_conditions=excluded.trigger_conditions,steps=excluded.steps,verification_rules=excluded.verification_rules,failure_modes=excluded.failure_modes,risk_class=excluded.risk_class,minimum_autonomy=excluded.minimum_autonomy,human_approval_required=excluded.human_approval_required,updated_at=now();

revoke all on public.lia_procedures from public;
grant select on public.lia_procedures to authenticated;
