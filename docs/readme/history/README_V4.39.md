# v4.40 — Value Suite

Cette version regroupe la feuille de route v4.32→v4.40 dans un centre de pilotage unique.

## Fonctionnalités
- Quick Actions : dépenses/revenus en un clic.
- Récurrences : détection locale + stockage des patterns confirmés.
- Centre d'alertes : accès aux notifications et actions.
- Objectifs : création et progression.
- Simulateur « Et si ? » : scénario isolé, aucune mutation.
- Score financier pédagogique et explicable.
- Clôture mensuelle.
- Nexo Actions : intentions prédéfinies vers Hermes.
- « Faire le point » : synthèse globale.
- Skill d'apprentissage rapide dans `docs/skills/ai-learning-fast.md`.

## Migration
Appliquer `supabase/migrations/0018_value_layer.sql` après les migrations existantes.

## Sécurité IA
Le skill d'apprentissage impose la séparation faits / interprétation / proposition / action à valider. Le LLM ne reçoit pas de pouvoir de mutation financière directe.


## v4.40 — UX & Intelligence Integration
- Personalized dashboard greeting using display_name.
- Contextual deterministic daily suggestion.
- One-click quick actions.
- Mobile-first app-like bottom navigation with iOS/Android safe-area support.
- UX foundation for understand → act → anticipate.
