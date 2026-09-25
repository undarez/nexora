# V5.09.01 — Production Hardening & Runtime Observability

Cette release commence la phase production sans ajouter de nouvelle autorité IA.

## Inclus
- Télémétrie runtime minimisée pour LIA : fournisseur, modèle, latence, tokens générés, débit et estimation de coût optionnelle.
- Migration `0112_lia_production_runtime_metrics.sql`.
- Console administrateur enrichie avec P50/P95, tokens et coût estimé sur 24 h.
- Endpoint strictement administrateur `/api/admin/lia/production-runtime`.
- Tarification distante configurable via `LIA_REMOTE_INPUT_COST_CENTS_PER_1K` et `LIA_REMOTE_OUTPUT_COST_CENTS_PER_1K`.
- Aucun prompt, aucune réponse et aucune donnée financière brute ne sont stockés dans cette télémétrie.
- Les coûts affichés sont des estimations opérateur, jamais une vérité de facturation.

## Gouvernance
Cette release ne donne aucune capacité supplémentaire à LIA : pas d'auto-promotion, pas d'activation automatique, pas de rollback automatique et aucune écriture financière autonome.

## Validation
`npm run production:hardening` doit retourner 11/11.
