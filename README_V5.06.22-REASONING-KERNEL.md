# NEXORA v5.06.22 — Reasoning Kernel

Ajout d'une couche de raisonnement déterministe indépendante de tout modèle de langage.

## Principe

Le Reasoning Kernel analyse chaque demande avant la génération linguistique :
- intention ;
- preuves nécessaires ;
- preuves manquantes ;
- niveau de risque ;
- prochaine étape cognitive ;
- contraintes de gouvernance.

Il ne donne jamais d'autorisation financière et ne dépend ni de GPT-OSS, ni d'Ollama, ni de ChatGPT/OpenAI.

Le moteur de langage, lorsqu'il existe, reçoit un état cognitif borné produit par NEXORA.
