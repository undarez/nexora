# NEXORA V5.08.8 — Unified Financial Cross-Domain

## Objectif

Faire de la donnée financière NEXORA un système transversal : comptes, transactions,
budget, charges fixes, objectifs, projection et LIA utilisent une même projection
de lecture afin que les pages ne travaillent plus en silos.

## Principes

- Le ledger bancaire connecté (`bank_accounts`, `bank_transactions`) et le ledger
  manuel (`accounts`, `transactions`) restent distincts pour éviter les doubles
  comptages.
- Une projection commune expose les agrégats croisés sans exposer de secrets,
  identifiants fournisseurs ou payloads bruts.
- Les transactions bancaires peuvent être reliées aux enveloppes budgétaires via
  `bank_transaction_envelope_links`.
- Le calcul `budget_scenarios.envelopes[*].spent` inclut désormais les allocations
  provenant des deux ledgers + l'ajustement manuel.
- Le dashboard, Budget, Transactions, Banque, Prévisions, Pilotage et Patrimoine
  affichent une vue financière croisée commune.
- Le Personal Financial Model de LIA reçoit également cette projection.
- Stripe reste dans le domaine paiement ; Powens reste le provider Open Banking.

## API

`GET /api/finance/unified-context?month=YYYY-MM-01`

La réponse contient notamment :

- liquidité bancaire connectée et comptes manuels séparés ;
- flux du mois et nombre d'opérations par source ;
- budget planifié/réel/restant ;
- charges fixes ;
- projection de fin de mois et marge de sécurité ;
- agrégation des dépenses par catégorie ;
- objectifs ;
- connexions bancaires ;
- indicateurs de réconciliation des deux ledgers.

## Migration

`supabase/migrations/0088_unified_financial_cross_domain.sql`

Elle crée la table de liaison des transactions bancaires aux enveloppes et étend
la synchronisation budgétaire existante.

## Sécurité

- route protégée par authentification et contrôle same-origin ;
- RLS sur la nouvelle table ;
- aucun secret Stripe/Powens exposé ;
- aucune donnée bancaire brute ajoutée à la projection LIA ;
- les projections sont en lecture seule et n'accordent aucune autorité financière.
