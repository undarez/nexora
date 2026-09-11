# NEXORA V5.11.06 — Android V1 functionalisation + deep cleanup

## Objectif

Cette version transforme la fondation Android en V1 fonctionnelle tout en conservant une seule source de vérité financière côté NEXORA Web/API.

## Web — nettoyage et audit

- Suppression de wrappers Supabase historiques inutilisés (`src/lib/client.ts`, `src/lib/server.ts`).
- Suppression du cache TypeScript `tsconfig.tsbuildinfo` et du lockfile Yarn au profit de npm.
- Remplacement des dépendances `latest` par les versions verrouillées dans `package-lock.json`.
- Mise à jour de plusieurs anciens tests de régression qui vérifiaient des composants/versions supprimés.
- Correction de la régression de sélection de stratégie Node en ajoutant l'import TypeScript explicite et `allowImportingTsExtensions`.
- Sweep des scripts de régression : **103/103 PASS**.

## Android

Architecture :

`Compose UI → ViewModel/StateFlow → Repository → Mobile API → NEXORA Core/Supabase`

L'application Android ne contient pas de calcul financier serveur ni de secret serveur.

Fonctions V1 :

- Authentification Supabase par email/mot de passe.
- Première visite liée au `Supabase user.id`.
- Accueil financier.
- Opérations bancaires/manuelles.
- Budget.
- Connexion Open Banking Powens via navigateur sécurisé puis retour `nexora://auth`.
- Liste et statut des connexions bancaires.
- Chat LIA mobile via `/api/mobile/lia/chat`.
- Accès secondaire à l'espace entreprise lorsqu'un workspace entreprise vérifié est disponible.
- Déconnexion.

## API mobile ajoutées

- `GET /api/mobile/context`
- `GET /api/mobile/transactions`
- `GET /api/mobile/banking/status`
- `POST /api/mobile/banking/connect`
- `GET /api/mobile/enterprise`
- `POST /api/mobile/lia/chat`

Les routes mutantes mobiles ont également la protection same-origin lorsqu'un en-tête Origin est présent. Les appels natifs Bearer sans Origin restent autorisés.

## Open Banking Android

Le secret Powens reste exclusivement côté serveur.

Le serveur génère une URL Powens et stocke un état OAuth à usage unique. Le callback consomme cet état, finalise la connexion puis redirige vers `nexora://auth` pour le client Android.

## Configuration Android

Copier `android/local.properties.example` vers `android/local.properties` et renseigner :

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `NEXORA_BASE_URL`

Ne jamais renseigner `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` ou une clé Powens secrète dans le projet Android.

## Validation

- 103/103 scripts de régression statique PASS.
- Les régressions User Guide, Release Candidate, Agent Completion, Security API Surface et Open Banking lifecycle PASS.
- Le build Next complet n'a pas été déclaré PASS dans cet environnement : l'installation npm a dépassé le délai disponible et `node_modules` n'était pas disponible. À exécuter localement avec `npm ci` puis `npm run build`.
- Le build Gradle doit être exécuté depuis Android Studio ou un environnement disposant du Gradle wrapper/SDK Android nécessaires.
