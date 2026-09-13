# NEXORA V5.08.35 — LIA Anomalies & Risk Reasoning

## Objectif
Ajouter un kernel déterministe de triage des anomalies financières et des dérives budgétaires.

## Principes
- Une anomalie n'est jamais une preuve de fraude, d'erreur ou d'incident.
- Les signaux sont explicables et accompagnés d'une question de vérification.
- Le score est un outil de triage, pas une probabilité de fraude.
- Lecture seule : aucune écriture financière, aucun outil, aucune mutation de mémoire.
- Les limites et données manquantes restent explicites.

## Signaux
- montant inhabituel ;
- dérive budgétaire ;
- pression sur la réserve de sécurité.

## Intégration
Le chat LIA ajoute les principaux signaux après l'analyse financière lorsque des données financières sont mobilisées.

## Validation
`npm run lia:risk-reasoning`
