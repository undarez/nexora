# NEXORA V5.08.57 — LIA Production Learning Telemetry

## Objectif
Mesurer la qualité réelle des réponses et recommandations produites après activation d'une Skill, sans conserver de contenu brut.

## Architecture
`active Skill -> production observation -> aggregate quality -> human review signal`

La télémétrie est descriptive : elle ne promeut, n'active, ne désactive, ne rollback et ne modifie jamais les poids du modèle, les policies, les faits financiers ou les permissions.

## Données
Seuls des indicateurs bornés sont conservés : score de qualité, verdict, correction, présence d'une recommandation, besoin d'approbation humaine, nombre d'éléments de preuve, Skill/version et horodatage.

## Gouvernance
- collecte uniquement pour une Skill `active` et son `active_version_id` exact ;
- accès dashboard/API administrateur ;
- RLS + aucun accès client direct ;
- fenêtre d'agrégation de 30 jours ;
- aucune activation/promotion/rollback automatique.
