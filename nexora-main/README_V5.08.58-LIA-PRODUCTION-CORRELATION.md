# NEXORA V5.08.58 — LIA Production Learning Correlation

Relie les observations de production à la version exacte de Skill activée et, lorsqu’elle existe, à sa version précédente.

## Principes
- Corrélation observationnelle uniquement : aucune inférence causale.
- Comparaison qualité, correction, blocage et recommandations.
- Confiance proportionnée à la taille des échantillons.
- Aucune conservation de prompt/réponse brute.
- Aucun apprentissage, promotion, activation ou rollback automatique.
- Surface d’administration uniquement.

## Flux
`Activation versionnée → observations production → comparaison avec baseline → signal → revue humaine`

## Validation
`npm run lia:production-correlation`
