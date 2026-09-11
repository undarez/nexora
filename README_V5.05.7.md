# NEXORA v5.05.7 — Diagnostic & Observability

Cette version poursuit l’optimisation de fiabilité sans ajouter de nouvelle couche d’agent.

## Changements
- Ajout d’une observabilité serveur structurée avec `requestId`, durée, événement et erreur normalisée.
- `/api/notifications/refresh` retourne désormais un `requestId` et journalise les chemins success/degraded/failure.
- `/api/admin/ai` retourne un `requestId` et journalise les échecs Ollama et les erreurs terminales sans exposer de secret.
- Correction importante : les timeouts par défaut de Hermes et Ollama étaient calculés mais le `fetch` recevait encore le signal utilisateur potentiellement `undefined`. Ils utilisent maintenant réellement `requestSignal`.
- Aucun appel hébergé/payant n’est activé automatiquement par cette version.

## Diagnostic
Les logs structurés permettent de corréler une erreur UI/API avec un identifiant de requête sans stocker de données financières individuelles.

## Validation
`node scripts/v5.05.7-observability-regression.mjs` doit afficher `PASS`.
Le build Next.js complet n’est pas déclaré validé dans cet environnement si les dépendances ne sont pas disponibles.
