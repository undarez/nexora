# NEXORA V5.08.48 — Security & API Surface Audit

## Objectif
Renforcer les surfaces d'API sensibles après V5.08.47, sans ouvrir de nouvelles capacités financières.

## Changements
- Ajout d'un contrôle same-origin CSRF sur les mutations utilisateur sensibles : Open Banking, Stripe, coffre financier, profil comportemental, onboarding et autres mutations API non-webhook/non-cron.
- Centralisation du contrôle administrateur de l'ingestion de connaissances LIA via `requireAdmin`.
- Conservation des exceptions explicites pour les webhooks fournisseurs et le cron serveur, qui utilisent leurs propres contrôles d'authentification/signature.
- Ajout d'une régression statique couvrant les routes API et les accès privilégiés évidents.

## Règles
- Une authentification utilisateur ne vaut pas autorisation administrateur.
- Les routes webhook ne doivent pas dépendre du CSRF navigateur ; elles restent protégées par leur signature fournisseur.
- Les jobs cron restent protégés par secret serveur.
- Les accès service-role nécessitent une revue de périmètre utilisateur/workspace et ne doivent jamais exposer de secret au client.

## Validation
`node scripts/v5.08.48-security-api-surface-audit.mjs`

Le typecheck/build complet doit être exécuté dans un environnement où les dépendances Node sont installées ; cette régression ne prétend pas remplacer ces vérifications.
