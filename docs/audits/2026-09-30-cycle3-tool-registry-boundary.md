# NEXORA / LIA — Cycle 3 Tool Registry Boundary Audit — 30 septembre 2026

## Objet

Deuxième contrôle Cycle 3 après l'extraction des handlers financiers. L'objectif est de vérifier que le **registre des capacités** ne réintroduit pas le couplage financier dans le cœur générique.

## Référence cible

`docs/project/ARCHITECTURE-TARGET.md` définit le runtime agentique comme une couche générique et précise que les opérations bancaires, comptes, transactions, budgets et écritures financières restent spécifiques au domaine financier.

## Constat initial

`src/lib/agent-runtime/tool-registry.ts` contenait auparavant les définitions de toutes les capacités financières :

- `get_financial_snapshot`
- `get_budget_status`
- `get_cashflow`
- `get_wealth_snapshot`
- `get_forecast`
- `search_transactions`
- `save_financial_insight`

Le registre était donc encore un point de connaissance financière directement embarqué dans le runtime générique.

## Risque architectural

Même sans accès direct aux tables, un registre générique qui possède les définitions et la sélection de capacités financières conserve une connaissance métier qui devrait appartenir au domaine financier. Cela fragilise l'objectif de pouvoir ajouter d'autres domaines sans enrichir le cœur générique avec leurs outils.

## Correction appliquée

### 1. Type partagé neutre

Création de `src/lib/agent-runtime/tool-definition.ts` pour héberger uniquement le contrat générique `AgentToolDefinition`.

### 2. Registre générique réduit

`src/lib/agent-runtime/tool-registry.ts` ne contient plus que les capacités génériques :

- recherche de Use Cases ;
- recherche de Skills ;
- recherche web ;
- apprentissage de Use Case candidat ;
- apprentissage de Skill candidat ;
- création de recommandation.

### 3. Registre financier détenu par le domaine

`src/lib/agent-runtime/financial-tool-adapter.ts` possède maintenant les définitions financières via `getFinancialAgentTool`, en plus de leur exécution.

La sélection financière `toolsForFinancialTask` reste également dans le domaine financier.

### 4. Résolution contrôlée dans l'executor

Le runtime générique résout une capacité par :

1. registre générique ;
2. registre financier explicitement déclaré.

Il ne possède pas les définitions financières et ne contient aucun handler financier.

### 5. Extraction de `save_financial_insight`

La capacité `save_financial_insight` et son accès à `lia_action_proposals` / `lia_action_audit` ont été déplacés dans l'adaptateur financier. Les contrôles d'autonomie et d'idempotence sont conservés.

## Régression

`scripts/lia-cycle3-tool-registry-boundary-regression.mjs` vérifie structurellement que :

- les capacités financières ne sont plus définies dans le registre générique ;
- chaque capacité financière reste définie dans l'adaptateur financier ;
- l'executor résout les définitions financières via l'adaptateur ;
- aucun handler financier ne réapparaît dans l'executor ;
- le contrat de type reste partagé et neutre.

## Gate

**Cycle 3 — Tool Registry Boundary : IMPLEMENTED.**

Le registre générique est désormais indépendant des capacités financières. La prochaine vérification doit porter sur le **policy registry / authorization layer**, car `src/lib/security/agent-identity.ts` contient encore une table de politiques qui connaît explicitement les outils financiers. Cette dépendance ne doit pas être supprimée sans auditer les RPC Supabase d'autorisation associés.
