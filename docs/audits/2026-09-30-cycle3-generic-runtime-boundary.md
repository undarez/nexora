# NEXORA / LIA — Cycle 3 Generic Agent Runtime Audit — 30 septembre 2026

## Objet

Premier audit Cycle 3 à partir du baseline `main` après stabilisation. Le but est de vérifier la séparation entre orchestration générique et autorité du domaine financier.

## Référence cible

`docs/project/ARCHITECTURE-TARGET.md` définit le runtime agentique comme une couche générique et précise que les opérations bancaires, comptes, transactions, budgets et écritures financières restent spécifiques au domaine financier.

## Constat principal

Le fichier `src/lib/agent-runtime/executor.ts` mélange actuellement plusieurs responsabilités :

1. identité et autorisation de l'agent ;
2. Policy Engine Supabase ;
3. Pre-Action Monitor ;
4. Decision Gate ;
5. exécution de recherche web ;
6. gestion des Skills et Use Cases ;
7. accès direct aux projections financières ;
8. accès direct aux tables financières ;
9. création de propositions financières ;
10. journalisation métier financière.

Le constat est reproductible par `scripts/lia-cycle3-generic-runtime-boundary-regression.mjs`.

## Correction appliquée

Le handler financier a été extrait vers `src/lib/agent-runtime/financial-tool-adapter.ts`. Le generic executor conserve la gouvernance et le dispatch, puis délègue les outils financiers à cet adaptateur. Il ne dépend plus directement de `financial-data-gateway` et ne contient plus les handlers financiers.

La régression Cycle 3 a été transformée en garde-fou structurel : toute réintroduction d'un handler financier direct dans l'executor générique doit faire échouer le test.

## Risque architectural

Le runtime générique possède actuellement des connaissances et chemins d'exécution spécifiques au domaine financier. Cela ne signifie pas qu'il dispose automatiquement d'une autorisation financière — les garde-fous existants restent actifs — mais la frontière de responsabilité cible n'est pas encore propre.

## Correction cible

Le prochain changement doit :

- conserver dans l'executor générique l'identité, les budgets d'exécution, le contrôle de politique et le dispatch ;
- déplacer les handlers financiers vers un adaptateur explicitement enregistré par le domaine financier ;
- empêcher le runtime générique d'importer directement `financial-data-gateway` ou de requêter les tables financières ;
- conserver les mêmes Decision Gates, permissions, audits et validations humaines ;
- ajouter une régression qui interdit toute dépendance financière directe dans le cœur générique.

## Gate

Cycle 3 — première correction de frontière : IMPLEMENTED. La séparation n'est pas encore considérée comme complète : le prochain audit doit vérifier les autres dépendances financières du runtime générique, notamment `toolsForTask`, les types de tâches et les éventuels chemins de persistance.
