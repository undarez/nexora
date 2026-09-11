# NEXORA Android — V5.11.07 Hardening

Cette étape durcit la V1 Android sans créer une seconde architecture métier.

## Changements

- Collecte Compose réellement lifecycle-aware avec `collectAsStateWithLifecycle`.
- Rafraîchissement de session et des données financières à la reprise de l'application.
- Nettoyage des données en mémoire lors de la déconnexion.
- Protection contre les doubles lancements de connexion bancaire / requêtes LIA concurrentes.
- Client HTTP avec `expectSuccess` et timeouts : connexion 10 s, requête/socket 20 s.
- Validation cliente minimale de l'e-mail et de la longueur des questions LIA ; le serveur reste l'autorité.
- Tests unitaires des garde-fous d'entrée.
- Conservation stricte de la séparation : Android ne reçoit jamais de secret service-role, Stripe ou Powens.

## Build local

Dans Android Studio récent :

1. Ouvrir le dossier `android/`.
2. Copier `local.properties.example` vers `local.properties`.
3. Renseigner `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` et `NEXORA_BASE_URL`.
4. Synchroniser Gradle.
5. Lancer les tests unitaires puis `assembleDebug`.
6. Pour une release Play Store, configurer une signature privée hors dépôt et produire un AAB release.

## Limites de validation de cet environnement

L'environnement de génération ne contient pas Android SDK/Gradle installés ; aucune APK/AAB n'est donc déclarée comme compilée ici. Les tests statiques et l'intégrité des fichiers peuvent être contrôlés, mais le build Android final doit être exécuté dans Android Studio ou un runner CI Android.

## Release Play Store — checklist

- [ ] signature release / Play App Signing configurée hors dépôt
- [ ] AAB release généré
- [ ] tests sur Android 8+ (API 26+) et appareils récents
- [ ] flux login/logout
- [ ] reprise après mise en arrière-plan
- [ ] retour Powens via `nexora://auth`
- [ ] expiration/reconnexion bancaire
- [ ] affichage transactions/budget
- [ ] LIA avec erreur réseau et timeout
- [ ] espace entreprise uniquement lorsqu'il est autorisé par le backend
- [ ] politique de confidentialité et Data Safety Play Console
- [ ] captures d'écran, icône, fiche Play Store
- [ ] vérification du deep link et prévention des redirections non autorisées
