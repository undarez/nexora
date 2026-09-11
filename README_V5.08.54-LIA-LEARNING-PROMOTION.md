# NEXORA V5.08.54 — LIA Learning Promotion Pipeline

## Objectif
Transformer un candidat d'apprentissage approuvé par revue humaine en skill `validated`, sans jamais l'activer automatiquement.

## Pipeline
`candidate → replay → review humaine → promotion gates → validated → activation séparée`

## Gates
- revue humaine `approved` ;
- verdict replay `improved` ou `no_regression` ;
- score candidat >= 80 ;
- aucune régression ;
- memory gate `useful`, `reliable`, `reproducible` ;
- candidat non obsolète ;
- skill encore au statut `candidate`.

## Sécurité
La promotion ne modifie jamais les poids du modèle, le Policy Engine, les faits financiers ou les permissions. Elle ne déclenche pas `active`. L'opération est atomique côté PostgreSQL et réservée au service role derrière une route admin + CSRF.
