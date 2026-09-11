create table if not exists public.lia_source_trust_registry (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  organization text not null,
  source_class text not null check (source_class in ('OFFICIAL','AUTHORITY','STANDARD','SCIENTIFIC','VENDOR','REPUTABLE_SECONDARY','COMMUNITY')),
  trust_score integer not null check (trust_score between 0 and 100),
  allowed boolean not null default false,
  freshness_days integer not null check (freshness_days between 1 and 3650),
  notes text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.lia_source_trust_registry enable row level security;
revoke all on public.lia_source_trust_registry from anon, authenticated;

create index if not exists lia_source_trust_registry_allowed_idx on public.lia_source_trust_registry(allowed, source_class);

insert into public.lia_source_trust_registry(domain,organization,source_class,trust_score,allowed,freshness_days) values
('eur-lex.europa.eu','EUR-Lex','OFFICIAL',98,true,30),
('ec.europa.eu','European Commission','OFFICIAL',98,true,30),
('europa.eu','European Union','OFFICIAL',97,true,30),
('edpb.europa.eu','European Data Protection Board','AUTHORITY',98,true,30),
('enisa.europa.eu','ENISA','AUTHORITY',98,true,60),
('cnil.fr','CNIL','AUTHORITY',98,true,30),
('anssi.gouv.fr','ANSSI','AUTHORITY',98,true,60),
('legifrance.gouv.fr','Légifrance','OFFICIAL',98,true,30),
('amf-france.org','AMF','AUTHORITY',97,true,30),
('acpr.banque-france.fr','ACPR','AUTHORITY',97,true,30),
('banque-france.fr','Banque de France','AUTHORITY',97,true,60),
('insee.fr','INSEE','OFFICIAL',97,true,90),
('iso.org','ISO','STANDARD',96,true,180),
('ietf.org','IETF','STANDARD',96,true,180),
('nist.gov','NIST','AUTHORITY',96,true,90),
('arxiv.org','arXiv','SCIENTIFIC',86,true,365),
('pubmed.ncbi.nlm.nih.gov','PubMed','SCIENTIFIC',92,true,365),
('openai.com','OpenAI','VENDOR',90,true,90),
('anthropic.com','Anthropic','VENDOR',90,true,90)
on conflict (domain) do update set organization=excluded.organization,source_class=excluded.source_class,trust_score=excluded.trust_score,allowed=excluded.allowed,freshness_days=excluded.freshness_days,version=public.lia_source_trust_registry.version+1,updated_at=now();
