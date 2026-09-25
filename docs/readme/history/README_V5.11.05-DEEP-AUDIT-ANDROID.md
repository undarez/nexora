# NEXORA V5.11.05 — Deep audit + Android foundation

## 1. Audit réalisé

Analyse statique du projet Web NEXORA V5.11.04 :

- 336 fichiers TypeScript/TSX dans `src`.
- 95 routes API.
- 110 migrations Supabase.
- recherche de doublons de contenu, wrappers historiques, caches de build et références obsolètes.
- vérification des scripts de régression et des versions de dépendances.

### Corrections appliquées

1. Suppression de `src/lib/client.ts`, doublon non référencé du client navigateur Supabase.
2. Suppression de `src/lib/server.ts`, wrapper serveur historique non référencé ; les routes utilisent `src/lib/supabase/server.ts`.
3. Suppression de `tsconfig.tsbuildinfo`, artefact de compilation qui ne doit pas être distribué avec le code source.
4. Remplacement des dépendances npm déclarées `latest` par les versions déjà résolues dans `package-lock.json` afin d'obtenir des builds reproductibles.
5. Correction du test release candidate V5.11.00 qui exigeait encore artificiellement la version `0.1.120` alors que le projet est en `0.1.123`.
6. Ajout de `v5.11.05-deep-audit-regression.mjs` : 14/14 contrôles PASS.

## 2. Android — nouvelle architecture

L'application Android est volontairement **native**, et ne reproduit pas les 37 pages Web.

### Stack

- Kotlin 2.4.20
- Android Gradle Plugin 9.3.1
- Gradle 9.5
- compile/target SDK 37
- min SDK 26
- Jetpack Compose + Material 3
- Navigation Compose
- ViewModel + StateFlow / UDF
- DataStore Preferences pour les préférences locales
- Supabase Kotlin Auth 3.8.0
- Ktor 3.5.1 pour les appels au backend NEXORA

Les choix suivent les recommandations Android actuelles : Compose pour l'UI, ViewModel/UDF pour l'état, Navigation Compose pour les destinations et DataStore pour les préférences. Le SDK Supabase Kotlin demande Android 26 minimum. Voir la documentation Android et Supabase référencée dans le rapport de version.

### Architecture simplifiée

`UI -> ViewModel -> Repository -> NEXORA Mobile API -> services NEXORA/Supabase`

L'application Android ne recopie pas la logique financière, LIA, Open Banking ou gouvernance du Web. Le backend reste la source de vérité.

### Navigation principale

Seulement 5 destinations :

1. Accueil
2. Transactions
3. Budget
4. Banque
5. LIA

Les fonctions secondaires (profil, aide, paramètres, entreprise, etc.) pourront être ouvertes depuis un menu secondaire sans polluer la navigation principale.

### Première visite

Le guide de première visite est lié au `user.id` Supabase dans DataStore. Deux utilisateurs sur le même téléphone ont donc deux états indépendants.

## 3. API mobile ajoutée

- `GET /api/mobile/context`
- `GET /api/mobile/transactions`
- `GET /api/mobile/banking/status`
- `POST /api/mobile/banking/connect`

Ces routes utilisent `Authorization: Bearer <Supabase access token>` et ne nécessitent pas de cookie navigateur.

Aucune clé service-role n'est exposée à Android.

## 4. Ce qui reste volontairement à brancher

La fondation Android est prête, mais elle n'est pas présentée comme une APK de production déjà validée : l'environnement de cette analyse ne disposait pas d'Android SDK/Gradle installé et le build Web complet ne pouvait pas non plus être exécuté faute de `node_modules` disponibles.

Avant publication Play Store :

- configurer `local.properties` avec URL Supabase, clé publishable et URL NEXORA ;
- configurer les redirect/deep links Supabase pour l'application ;
- tester la connexion bancaire Powens dans Custom Tabs puis retour dans l'application ;
- brancher le chat LIA mobile sur le même endpoint gouverné que le Web ;
- ajouter les tests instrumentés et le test sur appareils réels ;
- générer le bundle AAB release signé.

## 5. Sécurité

Ne jamais placer dans Android :

- `SUPABASE_SERVICE_ROLE_KEY`
- clé secrète Stripe
- secret webhook Stripe
- secret Powens
- secrets LIA/Ollama/provider

Android ne reçoit que des identifiants publics et le jeton de session de l'utilisateur. Les secrets restent côté serveur NEXORA.
