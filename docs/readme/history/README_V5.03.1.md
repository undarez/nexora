# NEXORA v5.03.1 — LIA Cognitive Core

## Objectif
NEXORA/LIA peut désormais répondre aux demandes financières courantes sans Hermes, sans GPT-OSS et sans fournisseur IA externe actif.

## Architecture
- Le serveur charge les données Supabase et les preuves déterministes.
- `src/lib/lia/deterministic-engine.ts` calcule et compose une réponse auditable.
- Budget, enveloppes, comptes, transactions, trésorerie, prévisions, objectifs et dérives sont traités localement.
- Les résultats continuent d'être enregistrés dans les tables existantes de boucles, preuves, sessions, recommandations et apprentissage.
- Un enrichissement génératif reste optionnel avec `LIA_GENERATIVE_ENHANCEMENT=true`.

## Limite volontaire
Sans modèle génératif, LIA ne prétend pas répondre à des questions générales hors du domaine financier à partir de connaissances qu'elle n'a pas. Elle répond à partir des données et règles réellement disponibles et indique lorsqu'une information externe est nécessaire.

## Validation
Après remplacement :
```powershell
npm ci
npm run build
```
Puis :
```powershell
npm run dev
```
