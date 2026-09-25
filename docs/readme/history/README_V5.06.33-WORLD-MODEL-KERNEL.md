# NEXORA v5.06.33 — World Model Kernel

## Objectif

Ajouter une couche de modèle conceptuel au-dessus des propositions du knowledge graph. Le World Model regroupe les nœuds par sujet, projette les relations connues et conserve les niveaux de confiance des nœuds sources.

## Garanties

- modèle descriptif, pas une vérité activée ;
- provenance conservée sur les nœuds sources ;
- contradictions non résolues silencieusement ;
- aucune mutation de mémoire ;
- aucune exécution d'outil ;
- aucune autorisation financière.

## Régression

`npm run lia:world-model`
