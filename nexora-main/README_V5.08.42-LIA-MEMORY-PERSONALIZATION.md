# NEXORA V5.08.42 — LIA Memory & Personalization

## Objectif
Durcir l'utilisation de la mémoire durable de LIA sans créer un second système de mémoire.

## Règles
- La mémoire acceptée reste la seule mémoire durable candidate au contexte conversationnel.
- Les mémoires de personnalisation (`user_request`, `strategic`, `procedural`) ne sont activées dans le contexte que si `consented_personalization=true`.
- Une mémoire expirée n'est jamais récupérée.
- Les secrets, tokens, IBAN/BIC, données de carte et identifiants bancaires sensibles sont retirés de la projection conversationnelle.
- Une demande explicite de mémorisation crée toujours un candidat ; elle ne vaut pas acceptation.
- La mémoire ne confère aucune autorisation d'action financière.
