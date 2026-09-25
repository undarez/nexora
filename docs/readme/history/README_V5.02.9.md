# NEXORA v5.02.9 — navigation, dark mode & admin surfaces

## Changements
- Sidebar desktop élargie et lisible (270 px) avec typographie 14 px.
- Sidebar desktop repliable (76 px) avec animation horizontale et mémorisation locale.
- Le contenu principal suit automatiquement l'état replié/déployé.
- Mode sombre éclairci : fond, cartes, champs et lignes moins proches du noir.
- Runtime LIA : interface et API réservées à l'administration.
- IA & Use Cases : interface et API réservées à l'administration.
- Veille financière : interface réservée à l'administration.
- Les utilisateurs standards ne voient plus ces entrées dans la navigation desktop/mobile.
- Les accès directs à ces routes sont redirigés vers `/dashboard` pour les non-administrateurs.
- Les nouveaux Use Cases générés par LIA restent des candidats gouvernés ; après validation/activation, le registre `lia_search_use_cases` les rend automatiquement disponibles à LIA. Aucun composant utilisateur n'est nécessaire pour cela.

## Important
- Aucune migration Supabase n'est ajoutée ou modifiée.
- La gouvernance des Use Cases reste volontairement conservatrice : un candidat généré par LIA n'est pas exécutable avant validation.
