# NEXORA V5.08.16 — Enterprise Unified Financial Context

## Objectif
Consolider la section Entreprise sans créer de nouvelles pages ni de nouveaux ledgers parallèles. La page Entreprise et son API consomment désormais un builder unique de contexte financier professionnel.

## Changements
- `src/lib/enterprise/financial-context.ts` devient la projection serveur de référence pour l'Entreprise.
- Croisement des comptes bancaires, transactions bancaires, transactions manuelles, budget et connexions Open Banking dans un même contexte.
- Calculs partagés : trésorerie par devise, disponible, encaissements, décaissements, net, budget prévu/dépensé/restant, burn 90 jours et autonomie indicative.
- Intelligence transactionnelle réutilisée sans action automatique.
- La page `/entreprise` et `/api/enterprise/context` consomment le même builder.
- Aucun nouvel écran financier créé.
- Les modules Banque, Transactions, Budget, Dashboard, Prévisions et Pilotage restent les surfaces spécialisées ; Entreprise les agrège sans dupliquer leur stockage.

## Règle de sécurité fonctionnelle
Les métriques multi-devises ne sont jamais additionnées entre elles. La métrique `cash` utilise la devise primaire (EUR si présente) et les montants par devise restent disponibles séparément.

## Validation
`npm run enterprise:context`

Le build global Next.js/typecheck doit être exécuté dans l'environnement projet avec les dépendances installées.
