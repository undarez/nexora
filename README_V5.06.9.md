# NEXORA V5.06.9 — Chapitre 1 : boucle autonome LIA

- Runtime borné d'orchestration : plan → exécution étape par étape → vérification → arrêt contrôlé.
- Procédures financières exécutées via les outils déterministes en lecture seule.
- Recherche externe branchée sur le Research Gateway gouverné.
- Human Gate conservé pour toute action sensible.
- Vérification rétrocompatible avec les règles de procédure textuelles et les règles `required_path`.
- Endpoint `POST /api/lia/orchestrate/run`.
- Bouton « Exécuter le plan » dans `/orchestration`.
- Les critères de réussite du Use Case sont automatiquement transmis au run si le client n'en fournit pas.

## Garde-fous
Aucune procédure autonome de ce chapitre n'effectue de mouvement financier. Les écritures sensibles restent soumises à la politique serveur et au Human Gate.
