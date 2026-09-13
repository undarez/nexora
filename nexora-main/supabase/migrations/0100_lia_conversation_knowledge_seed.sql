-- NEXORA V5.08.31 — LIA conversation + initial validated financial knowledge.
-- Knowledge is evidence/context only. It never grants action authority.

insert into public.financial_knowledge_sources (source_key,title,publisher,authority,url,topics,status)
values
  ('amf-actions-risk-2023','Rendement et risque des placements en actions','Autorité des marchés financiers','A','https://www.amf-france.org/fr/espace-epargnants/savoir-bien-investir/cadrer-son-projet/rendement-et-risque-des-placements-en-actions-0',array['investissement','risque','rendement'], 'active'),
  ('amf-diversification-2023','Bien diversifier son épargne pour atteindre ses objectifs','Autorité des marchés financiers','A','https://www.amf-france.org/fr/espace-epargnants/lexique-simulateurs-et-outils-pratiques/mon-zoom-epargne/bien-diversifier-son-epargne-pour-atteindre-ses-objectifs',array['épargne','diversification','risque'], 'active'),
  ('amf-investor-rules','Quelques conseils pour bien investir','Autorité des marchés financiers','A','https://www.amf-france.org/fr/espace-epargnants/savoir-bien-investir/conseils-pratiques/les-regles-dor-de-linvestisseur',array['investissement','risque','vérification'], 'active'),
  ('amf-savings-goal','Définir son objectif d’épargne pour bien choisir son placement','Autorité des marchés financiers','A','https://www.amf-france.org/fr/espace-epargnants/savoir-bien-investir/cadrer-son-projet/definir-son-objectif',array['épargne','objectif','horizon','risque'], 'active'),
  ('cnil-ai-minimisation','Développement des systèmes d’IA : minimisation des données','CNIL','A','https://www.cnil.fr/fr/developpement-des-systemes-dia-les-recommandations-de-la-cnil-pour-respecter-le-rgpd',array['ia','rgpd','données','minimisation'], 'active')
on conflict (source_key) do update set title=excluded.title,publisher=excluded.publisher,authority=excluded.authority,url=excluded.url,topics=excluded.topics,status='active',updated_at=now();

insert into public.financial_knowledge_items (knowledge_key,knowledge_type,domain,title,statement,authority,confidence,status,tags,metadata)
values
 ('lia-investment-risk-not-guaranteed','claim','financial_agents','Risque et rendement des actions','Un placement en actions comporte un risque de perte et aucun rendement n’est garanti ; le potentiel de rendement doit toujours être présenté avec le risque correspondant.','A',0.98,'validated',array['investissement','actions','risque','rendement'],jsonb_build_object('source_key','amf-actions-risk-2023')),
 ('lia-diversification-reduces-risk','practice','financial_agents','Diversification de l’épargne','Diversifier les placements et les expositions peut réduire les fluctuations et le risque de concentration, sans supprimer le risque de perte.','A',0.98,'validated',array['épargne','diversification','risque'],jsonb_build_object('source_key','amf-diversification-2023')),
 ('lia-investor-verifications','practice','financial_agents','Vérifications avant investissement','Avant un investissement, l’épargnant doit notamment vérifier les risques, les autorisations applicables de l’intermédiaire et la documentation fournie.','A',0.97,'validated',array['investissement','intermédiaire','vérification'],jsonb_build_object('source_key','amf-investor-rules')),
 ('lia-savings-horizon-risk','concept','financial_agents','Objectif, horizon et risque','Le choix d’un placement doit tenir compte de l’objectif, de l’horizon de placement, de la disponibilité nécessaire de l’argent et de la capacité à supporter une perte.','A',0.98,'validated',array['épargne','objectif','horizon','risque'],jsonb_build_object('source_key','amf-savings-goal')),
 ('lia-ai-data-minimisation','control','financial_agents','Minimisation des données pour l’IA','Les données personnelles utilisées par un système d’IA doivent être adéquates, pertinentes et limitées à ce qui est nécessaire pour la finalité définie.','A',0.98,'validated',array['ia','rgpd','minimisation','données'],jsonb_build_object('source_key','cnil-ai-minimisation'))
on conflict (knowledge_key) do update set statement=excluded.statement,confidence=excluded.confidence,status='validated',tags=excluded.tags,metadata=excluded.metadata,updated_at=now();

insert into public.financial_knowledge_evidence (knowledge_id,source_id,evidence_location,excerpt)
select k.id,s.id,'source_reference','Source officielle conservée dans financial_knowledge_sources.'
from public.financial_knowledge_items k
join public.financial_knowledge_sources s on s.source_key=(k.metadata->>'source_key')
where k.knowledge_key in ('lia-investment-risk-not-guaranteed','lia-diversification-reduces-risk','lia-investor-verifications','lia-savings-horizon-risk','lia-ai-data-minimisation')
  and not exists (select 1 from public.financial_knowledge_evidence e where e.knowledge_id=k.id and e.source_id=s.id);
