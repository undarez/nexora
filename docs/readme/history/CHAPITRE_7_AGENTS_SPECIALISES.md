# Chapitre 7 — Agents spécialisés Nexora

## Objectif
Transformer le Command Engine du chapitre 6 en runtime multi-agent gouverné.

LIA reste le Supervisor. Les agents spécialisés ne reçoivent jamais une autorisation implicite simplement parce qu'une intention a été détectée.

## Agents

- `copywriting` — contenus, UX copy, emails. Aucun publish implicite.
- `seo` — audit SEO technique/éditorial et métadonnées.
- `system-admin` — santé système, diagnostics et build analysis, sans auto-déploiement implicite.
- `data` — qualité, déduplication, anomalies. Toute mutation reste contrôlée.
- `finance` — analyse financière et objectifs.
- `mobility` — carburant, véhicules, trajets.
- `research` — recherche Tavily et confiance des sources.

## Pipeline

```text
Utilisateur
  ↓
Intent Detector
  ↓
Parameter Extraction
  ↓
Policy Engine
  ↓
Command Router
  ↓
Specialist Agent
  ↓
Skill
  ↓
Verification
  ↓
LIA Supervisor / réponse
```

## Garde-fous

Chaque agent possède :

- permissions explicites ;
- niveau d'autonomie ;
- nombre maximum d'étapes ;
- nombre maximum de retries ;
- skills autorisés ;
- vérification obligatoire ;
- confirmation humaine pour les opérations d'écriture/critique.

Une intention `data.deduplicate` reste en `waiting_confirmation` tant qu'une confirmation explicite n'est pas obtenue.

## Skills exécutables du chapitre 7

Les premiers adapters non destructifs sont réellement exécutables :

- `content-generation` : brouillon uniquement ;
- `technical-seo` : audit local d'un contenu fourni ;
- `system-health` : contrôle local non destructif ;
- `data-quality` : contrôle de qualité sans mutation.

Les skills qui nécessitent un accès métier réel (transactions, Supabase, Vercel, Tavily, etc.) restent derrière des adapters dédiés : le routeur ne doit jamais simuler leur exécution.

## Persistance

La migration `0120_lia_specialist_agents.sql` crée :

- `lia_specialist_agents` : registre de gouvernance ;
- `lia_specialist_runs` : audit des exécutions par utilisateur.

RLS est activé sur les deux surfaces ; le registre d'agents reste server-only et les runs sont visibles uniquement par leur utilisateur.

## Validation

```bash
npm run lia:command-engine
npm run lia:chapter7-agents
```

Le build Next complet doit être relancé dans l'environnement local de développement où `node_modules` est installé.
