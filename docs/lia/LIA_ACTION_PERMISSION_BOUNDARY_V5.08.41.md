# NEXORA V5.08.41 — LIA Action & Permission Boundary

## Objectif
Formaliser une frontière unique entre la capacité de LIA à lire/analyser/proposer et toute exécution.

## Règles
- La sortie du modèle n'est jamais une autorisation.
- Les actions sont allow-listées côté serveur.
- `create_recommendation` est la seule action actuellement planifiable/exécutable par ce flux.
- Une proposition nécessite une validation humaine explicite avant exécution.
- Une action non réversible est refusée par le runtime.
- LIA ne peut pas écrire directement dans les données financières.
- Les futures écritures financières devront obtenir une permission dédiée, un contrat d'impact, une validation humaine explicite et un mécanisme de rollback avant d'être activées.
- Les secrets, tokens bancaires et contenus d'e-mails ne deviennent jamais une autorité d'action.

## Flux
`LIA -> plan allow-listé -> proposition -> impact preview -> approbation humaine -> policy server -> claim atomique -> exécution serveur -> observation -> audit`

## Non-objectifs
Cette version n'active aucune nouvelle action financière et ne donne pas à LIA le pouvoir d'effectuer un virement, modifier un compte bancaire, supprimer une transaction ou changer un budget sans un futur contrat d'autorisation explicite.
