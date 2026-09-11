# V5.08.28 — Identité légale Entreprise & SIRET

## Objectif

Finaliser la règle métier Entreprise : un espace professionnel doit être rattaché à un SIRET valide, retrouvé dans le registre officiel et correspondant à un établissement actif.

## Changements

- validation locale du SIRET + contrôle SIRENE ;
- refus des établissements fermés ou à statut inconnu ;
- unicité du SIRET dans NEXORA ;
- SIRET vérifié non modifiable directement ;
- endpoint sécurisé de lecture du profil Entreprise ;
- affichage de l'identité légale vérifiée directement dans le cockpit ;
- aucune nouvelle table nécessaire.

## Limite importante

Le registre public permet de vérifier l'existence et le statut de l'établissement. Cela ne constitue pas une preuve juridique que la personne connectée dispose d'un mandat ou d'un pouvoir de représentation. Si NEXORA doit exiger cette preuve, il faudra ajouter ultérieurement un parcours de vérification de représentant légal (par exemple justificatif + contrôle adapté), séparé de la simple vérification du SIRET.

## Validation

```powershell
npm install
npm run enterprise:identity
npm run build
```
