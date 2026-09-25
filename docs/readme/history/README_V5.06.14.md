# NEXORA V5.06.14 — Financial Agent Memory Pipeline v2

Cette version réconcilie `NEXORA-FINANCIAL-AGENT-MEMORY-PIPELINE-v2.0.0` avec l'architecture existante.

## Ajouts
- mémoire financière versionnée et immutable par snapshots
- intégrité SHA-256 et rollback vers la dernière version validée
- Decision Gate : ALLOW / ALLOW_WITH_GUARDRAIL / REQUIRE_APPROVAL / ESCALATE / BLOCK
- télémétrie comportementale agentique
- signaux de drift
- intégration du Decision Gate à l'exécuteur d'outils
- versionnement des demandes de mémoire explicites
- skill Financial Agent Intelligence conservé comme baseline gouvernée
- habitudes financières conservées comme observations statistiques
- knowledge/retrieval remain evidence-only

## Sécurité
Aucune connaissance, mémoire, habitude ou contenu externe ne peut créer une autorisation. Les écritures sensibles et actions critiques restent soumises au Policy Engine et à la validation humaine.
