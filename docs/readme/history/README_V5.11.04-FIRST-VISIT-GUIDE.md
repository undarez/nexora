# NEXORA V5.11.04 — FIRST VISIT GUIDE

## Objectif
Afficher le guide de démarrage automatiquement uniquement lors de la première visite d'un utilisateur authentifié.

## Implémentation
- `src/components/help/first-visit-guide.tsx`
- `src/app/(protected)/layout.tsx`

La clé de stockage est liée à l'identifiant Supabase de l'utilisateur :
`nexora:first-visit-guide:v1:<userId>`.

Ainsi, deux comptes différents sur le même navigateur ont chacun leur première visite.

Le guide est affiché depuis le shell protégé, donc il apparaît dès l'entrée dans l'application authentifiée, sans créer une nouvelle page.

## Comportement
- Première visite : affichage automatique.
- « J'ai compris », fermeture ou passage vers le guide : le guide est marqué comme vu.
- Visites suivantes : aucune réapparition.
- La page `/aide` et le parcours complet restent disponibles manuellement.

## Limite volontaire
La persistance est côté navigateur et indexée par `user.id`. Si les données locales du navigateur sont supprimées, le guide peut réapparaître. Aucune nouvelle colonne ou migration Supabase n'est ajoutée pour éviter de modifier le schéma financier pour une préférence UX.
