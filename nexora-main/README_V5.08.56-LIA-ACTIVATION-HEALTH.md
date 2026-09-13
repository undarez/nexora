# V5.08.56 — LIA Activation Health & Rollback Guard

NEXORA ajoute une observation post-activation des Skills actives. Les événements `succeeded` et `failed` de la version exacte activée sont agrégés sur 30 jours, avec une fenêtre récente de 7 jours.

## Gates
- 0 observation: `insufficient_data`.
- ≥20 % d'échecs: `watch` et revue humaine recommandée.
- ≥40 % d'échecs, ou ≥30 % d'échecs récents: `critical` et revue/rollback recommandé.
- Aucun rollback automatique.
- Aucune modification des poids du modèle, policies, faits financiers, permissions ou activation depuis ce moteur.

## Administration
- `GET /api/admin/lia/activation-health`
- intégré au Learning Review Board (`/admin/lia-learning`).
- réservé aux administrateurs.

## Principe
Observation → alerte → décision humaine → rollback gouverné si nécessaire.
