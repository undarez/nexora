# NEXORA v5.07.2 — LIA User Interface

## Objectif
Espace utilisateur dédié à LIA, relié à l'API `/api/lia/chat` et au Cognitive Loop existant.

## Principes
- LIA est accessible directement depuis la navigation.
- L'interface conserve une conversation locale bornée aux 12 derniers messages.
- Le contexte serveur continue d'utiliser les sessions/mémoire/modèle personnel existants.
- Aucune autorisation financière n'est accordée par l'interface.
- Les actions sensibles restent soumises aux politiques et au Decision Gate.

## Validation
La vérification statique porte sur la présence de la route, de l'appel API et du lien de navigation. Faire `npm install` puis `npm run build` dans l'environnement du projet pour la validation Next.js complète.
