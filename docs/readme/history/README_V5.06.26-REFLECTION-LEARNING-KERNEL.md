# NEXORA v5.06.26 — Reflection & Learning Kernel

Ajout du Reflection & Learning Kernel après Reasoning, Planning, Critique et Decision.

## Chaîne cognitive

Reasoning → Planning → Critique → Decision → Policy/Decision Gate → Action éventuelle → Reflection/Learning

Le kernel de réflexion :
- évalue le résultat d'un parcours cognitif ;
- distingue succès, échec, blocage, attente humaine et annulation ;
- détecte les lacunes de preuve, corrections utilisateur et besoins de replanification ;
- produit des signaux d'apprentissage bornés ;
- propose des leçons sans les persister automatiquement ;
- n'exécute aucun outil ;
- ne modifie jamais directement la mémoire ;
- n'autorise aucune écriture financière ;
- laisse Policy Engine et Decision Gate comme autorités finales.

## Principe

Une observation n'est pas une mémoire durable.
Une leçon proposée n'est pas une autorisation.
Une correction utilisateur doit être validée avant toute mutation durable.

Aucune migration Supabase n'est nécessaire.
