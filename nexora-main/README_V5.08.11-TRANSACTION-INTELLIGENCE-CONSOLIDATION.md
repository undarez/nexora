# NEXORA V5.08.11 — Transaction Intelligence & Page Consolidation

## Objectif
Consolider les fonctions financières dans les pages existantes, enrichir la source financière unifiée et terminer les points manquants du parcours Open Banking Powens.

## Consolidation UX
- `Pilotage` devient le centre unique pour l'autopilote et les habitudes financières.
- `/autopilot` redirige vers `/pilotage#autopilot`.
- `/habitudes` redirige vers `/pilotage#habitudes`.
- Les entrées de navigation dédiées ont été supprimées pour éviter les doublons.
- Le Dashboard, Budget, Transactions, Banque, Prévisions, Patrimoine et Pilotage continuent de partager `UnifiedFinancialContext`.

## Financial intelligence
`UnifiedFinancialContext` passe en version 4 et expose une intelligence dérivée des transactions des 180 derniers jours :
- récurrences candidates ;
- anomalies statistiques prudentes ;
- aucune observation n'est transformée automatiquement en autorisation financière.

Les données sont affichées dans le composant transversal `FinancialCrossDomainSummary`, réutilisé par les pages financières existantes.

## Open Banking Powens
- découverte des comptes activés et désactivés via un endpoint serveur ;
- activation explicite des comptes sélectionnés côté serveur ;
- synchronisation après activation ;
- lecture de l'état fournisseur après callback ;
- distinction `active` / `needs_reauth` / `error` lorsque Powens fournit un état connu ;
- corrélation du callback avant interrogation de l'état fournisseur ;
- conservation des webhooks idempotents et signés ;
- aucun identifiant bancaire brut exposé au navigateur.

Powens documente que les comptes découverts peuvent être désactivés par défaut pour des raisons GDPR et doivent faire l'objet d'une activation explicite avant la synchronisation complète. Les webhooks restent la voie recommandée pour maintenir les données à jour.

## Contrôles
- `npm run banking:check`
- `npm run financial:cross-domain`
- `npm run finance:architecture`
- transpilation TypeScript/TSX des fichiers modifiés sans erreur syntaxique.

Le `typecheck` complet n'est pas considéré comme validé dans l'artefact tant que les dépendances du projet (`node_modules`) ne sont pas installées dans l'environnement d'exécution.
