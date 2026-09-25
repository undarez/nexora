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

# V5.08.55 — LIA Skill Activation Governance

## Objectif
Finaliser le passage `validated -> active` par un contrôle de plan de contrôle administrateur explicite.

## Chaîne
`candidate -> replay -> human review -> promoted -> validated -> explicit admin activation -> active`

## Garde-fous
- activation réservée au pipeline gouverné ; l'ancien RPC d'activation échoue désormais fermé ;
- justification d'activation obligatoire (10–2000 caractères) ;
- skill `validated` et trust score >= 70 ;
- memory gate useful/reliable/reproducible obligatoire et obsolete interdit ;
- promotion du Learning Review Board exigée pour la version exacte ;
- la version activée est épinglée via `active_version_id` ;
- historique d'activation conservé ;
- rollback administrateur gouverné, avec restauration de la version précédemment activée si disponible ;
- aucune modification automatique des poids du modèle, policies, faits financiers ou permissions.

## API
- `POST /api/admin/lia/skill-activation` : `activate` ou `rollback` avec justification.
- `/api/admin/veille` utilise désormais le RPC d'activation gouverné.

## Validation
`V5.08.55 Skill Activation Governance: 12/12 PASS`.
