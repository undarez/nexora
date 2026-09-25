# NEXORA v5.04.10 — Strategy Selection 2.0

## Objectif
Relier la mémoire stratégique consolidée au choix réel de stratégie avec une exploration contrôlée et bornée.

## Principes
- sélection uniquement dans une allow-list fournie par l'orchestrateur ;
- combinaison des expériences contextuelles et de la mémoire consolidée ;
- confiance utilisée comme stabilisateur, jamais comme permission ;
- exploration déterministe et bornée à 10% par défaut, plafonnée à 20% ;
- exploration uniquement entre stratégies déjà autorisées ;
- aucune modification de l'autonomie, des policies, des Human Gates ou des capacités d'exécution.

## Runtime
`src/lib/lia/strategy-selection.ts` expose `selectStrategyV2`.
L'orchestrateur charge maintenant `lia_strategy_memory` et utilise cette sélection avant de construire son plan.

## Validation
`npm run lia:strategy-selection`
Contrat local validé dans l'environnement de génération.
