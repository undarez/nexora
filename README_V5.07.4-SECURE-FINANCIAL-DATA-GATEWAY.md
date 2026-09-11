# NEXORA v5.07.4 — Secure Financial Data Gateway

## Objectif
Créer une frontière unique entre les données financières serveur et le contexte exposable à LIA.

## Principes
- Le navigateur et le moteur linguistique ne reçoivent pas les identifiants bruts de comptes/transactions.
- Les libellés de transactions et références fournisseurs ne sont pas exposés dans la projection LIA.
- Le payload du Financial Secure Vault n'est jamais déchiffré pour LIA.
- La projection est en lecture seule et ne confère aucune autorité.
- Les outils déterministes peuvent conserver des données brutes côté serveur, mais leurs résultats envoyés au moteur linguistique sont minimisés.

## Nouvelle couche
`src/lib/lia/financial-data-gateway.ts`

Elle produit une projection L3 comprenant uniquement :
- agrégats de comptes ;
- soldes par devise ;
- nombre de comptes ;
- agrégats revenus/dépenses/net ;
- agrégats par catégorie ;
- distribution temporelle simple ;
- présence et nombre d'éléments du coffre, sans contenu.

## API
`GET /api/lia/financial-context?days=90`

Réponse privée et `no-store`.

## Intégration
`get_financial_snapshot` utilise désormais la passerelle afin que l'outil financier de référence respecte la même frontière.

## Validation
`npm run lia:financial-data-gateway-regression`
