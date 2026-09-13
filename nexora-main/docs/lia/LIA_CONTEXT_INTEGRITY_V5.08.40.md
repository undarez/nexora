# LIA — Context Integrity V5.08.40

## Objectif
Stabiliser le pont `LiaApplicationContext` après l'intégration multi-source.

## Corrections
- Le champ `multi_source` du retour de `buildLiaApplicationContext` construit désormais réellement un objet `LiaMultiSourceContext`.
- Les comptes financiers sont évalués depuis `model.financial.accounts`, qui correspond au modèle financier compacté.
- Les fournisseurs mail connectés sont récupérés depuis `lia_mail_connections` et transmis au contexte multi-source.
- Les connexions mail restent des métadonnées : aucun corps d'email, aucune pièce jointe et aucune autorité d'action ne sont ajoutés.
- Le contexte financier reste la source de vérité.

## Régressions
- `scripts/v5.08.40-lia-context-integrity-regression.mjs` : 10/10 PASS.
- `scripts/v5.08.39-lia-multi-source-regression.mjs` : 13/13 PASS.

Aucun nouveau droit d'action n'est introduit.
