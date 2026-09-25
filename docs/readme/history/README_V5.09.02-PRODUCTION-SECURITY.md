# V5.09.02 — Production Security Hardening

Cette release poursuit le passage en production sans ajouter de nouvelle autorité IA.

## Inclus
- Alignement du contrôle de production Supabase avec `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` et compatibilité avec l'ancien `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Protection same-origin sur les trois endpoints publics d'authentification qui modifient l'état : inscription, renvoi de confirmation et réinitialisation du mot de passe.
- Limitation de taille des corps JSON sur ces endpoints (`32 KiB`) avant parsing.
- En-têtes de sécurité renforcés : HSTS, COOP et désactivation du DNS prefetch.
- `Cache-Control: no-store` pour les réponses API afin d'éviter la mise en cache de données financières ou d'état applicatif.
- Régression dédiée `scripts/v5.09.02-production-security-regression.mjs` : 9/9.

## Gouvernance
Aucune nouvelle capacité d'action pour LIA. Les limites d'autorité, l'approbation humaine et les garde-fous existants restent inchangés.

## Validation
- `v5.09.02-production-security-regression.mjs` : 9/9 PASS
- `v5.09.01-production-hardening-regression.mjs` : 11/11 PASS
- `v5.08.48-security-api-surface-audit.mjs` : PASS, 95 routes auditées

Le build/typecheck complet n'est pas déclaré comme validé ici si les dépendances du projet ne sont pas installées dans l'environnement d'exécution.
