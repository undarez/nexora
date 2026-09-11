# NEXORA v5.06.30 — Scenario & Counterfactual Kernel

## Objectif

Ajouter une couche de simulation conditionnelle au-dessus du Causal Reasoning Kernel.

Le kernel distingue les scénarios de référence, contre-factuels, de stress et alternatifs.
Il ne présente jamais une projection comme un fait.

## Garde-fous

- aucun fait créé ;
- aucune mutation mémoire ;
- aucune exécution d'outil ;
- aucune autorisation financière ;
- les contre-factuels exigent un support causal >= 80 ;
- les scénarios de stress restent conditionnels et exigent des hypothèses explicites ;
- Policy Engine et Decision Gate restent les autorités.

## Validation

`npm run lia:scenario-kernel`

Aucune migration Supabase n'est nécessaire.
