# NEXORA — Chapitre 6 — Skill Improvement / Skill Laboratory

Le chapitre 6 transforme l'évaluation en amélioration candidate, sans auto-activation.

## Boucle

`Skill active/validated → Challenger → cas difficiles → proposition vNext → replay des cas générés + régression → candidate → Review Board → promotion gouvernée → activation séparée`.

## Garde-fous

- maximum 3 cas de challenge par laboratoire ;
- aucune recherche externe dans le laboratoire ;
- aucun écrit financier ;
- aucune modification de policy, permission ou modèle ;
- les contenus candidats sont bornés et fingerprintés dans la télémétrie ;
- le replay décide uniquement de l'éligibilité à la revue humaine ;
- `activationAllowed=false` reste invariant ;
- le quota autonome de recherche 20 % n'est pas consommé par le laboratoire.

## Validation

`npm run lia:chapter6`

## Hardening final

Les cas générés par le Challenger sont maintenant transformés en scénarios de replay déterministes. Le laboratoire exécute chaque scénario contre le contenu candidat, compare baseline/candidate, compte les échecs de challenges et conserve uniquement les empreintes et résultats de replay dans la télémétrie. Le contenu brut du Skill n'est pas persisté par le replay.

Le laboratoire ne peut toujours pas activer ou promouvoir automatiquement une Skill : l'éligibilité signifie uniquement **soumission à la revue humaine/gouvernée**.
