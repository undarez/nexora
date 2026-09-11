# NEXORA V5.06.2 — LIA runtime bootstrap

- Bootstrap Cron LIA déplacé dans le shell protégé : toute page authentifiée peut provisionner les jobs.
- Clé de session passée à `v2` pour forcer une nouvelle vérification après les anciennes versions.
- Le Cron d’apprentissage autonome est désormais provisionné indépendamment de l’activité financière, par défaut une fois par semaine.
- La surveillance financière reste adaptative et économique : elle n’est créée que lorsqu’un contexte financier existe.
- Ajout de `npm run dev:clean` pour supprimer `.next` avant de relancer Next.js en cas de cache webpack corrompu.
