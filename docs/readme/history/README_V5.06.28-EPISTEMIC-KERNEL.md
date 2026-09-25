# NEXORA v5.06.28 — Epistemic & Uncertainty Kernel

Ajoute une couche qui modélise ce que NEXORA peut légitimement considérer comme connu, probable, inconnu, contradictoire ou obsolète.

## Principes
- `unknown` n'est jamais interprété comme faux.
- `probable` n'est jamais présenté comme certain.
- Les conflits doivent être réconciliés avant une conclusion fiable.
- Les informations obsolètes nécessitent un rafraîchissement.
- Les faits externes nécessitant des preuves ne sont pas inventés lorsque la recherche n'est pas disponible.
- Les préférences utilisateur nécessitant confirmation restent des demandes de clarification.
- Aucune création de fait, mutation mémoire ou autorisation financière.
- Policy Engine et Decision Gate restent les autorités finales.

## Chaîne cognitive
Reasoning → Planning → Critique → Decision → **Epistemic Check** → Policy/Decision Gate → Action → Reflection → Learning → Memory Consolidation

## Validation
`npm run lia:epistemic-kernel`
