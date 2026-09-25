# NEXORA V5.08.15 — Enterprise Financial Cockpit

## Objectif
Construire la section Entreprise sans créer de nouveau silo : identité légale, Open Banking, trésorerie, transactions et budget remontent dans un même cockpit.

## Scope
- workspace_id sur les principaux ledgers financiers ;
- connexion bancaire Powens rattachable à un workspace entreprise ;
- propagation du workspace_id lors de la synchronisation comptes/transactions ;
- endpoint `/api/enterprise/context` ;
- cockpit `/entreprise` avec trésorerie, encaissements, décaissements, comptes, budget et identité ;
- aucune nouvelle page financière.

## Isolation
Les lignes personnelles existantes restent `workspace_id = NULL`. Les nouvelles données entreprise sont explicitement rattachées au workspace et protégées par RLS membre.
