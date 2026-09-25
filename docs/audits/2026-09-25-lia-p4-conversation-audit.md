# Audit NEXORA / LIA — 25 septembre 2026

## 1. Objet

Audit ciblé réalisé avant le premier test E2E du cycle P4 Continuous autonomous operations, avec revue complémentaire de la conversation LIA et de l’organisation documentaire.

## 2. P4 — état réel observé

Le job Supabase LIA · Opérations continues existe et est configuré en :
- schedule : 0 20 * * *
- timezone : UTC
- status : ready
- prochaine exécution : 20:00 UTC le 25/09/2026
- dernière exécution : aucune
- dernière erreur : aucune
- échecs consécutifs : 0
- action : continuous_operations
- financial_writes_allowed : false
- requires_policy_gate : true

À ce stade, aucune ligne de réveil n’est présente dans lia_autonomous_wakes. La seule trace historique du job est un événement de planification créé le 24/09 ; il ne constitue pas une preuve d’exécution.

### Conclusion P4

Déploiement : validé. Configuration : validée. Exécution autonome réelle : non encore prouvée.

Preuve attendue : Vercel Cron → /api/lia/runtime/cron → claim du job → runLiaContinuousCycle → prepareLiaWake → opération → vérification → lia_autonomous_wakes.

## 3. Décision attendue du prochain réveil

L’état observé présente 22 objectifs agentiques actifs, 0 échec récent sur 24 h, 0 cycle d’apprentissage sur 7 jours et 0 boucle proactive sur 24 h.

Le sélecteur P4 donne donc normalement priorité à l’opération goal. Cette valeur est une conséquence de l’état observé et doit être vérifiée dans la trace réelle plutôt que considérée comme garantie.

## 4. Audit du dialogue LIA

Le fichier utilisateur fourni montre un problème clair : au lieu d’une réponse conversationnelle, LIA peut exposer des éléments internes comme les kernels NEXORA, des JSON de contexte, des contraintes de gouvernance et des traces de raisonnement. Cela produit précisément l’effet de charabia signalé.

Le fallback du provider était également trop technique : il parlait de fournisseur IA externe, de moteur déterministe et de disponibilité du NEXORA Brain. Ce diagnostic appartient au runtime, pas à la conversation utilisateur.

### Corrections intégrées

1. Détection des sorties qui contiennent des marqueurs internes.
2. Rejet automatique d’une réponse générée qui ressemble à une fuite de contexte interne ou à un dump JSON.
3. Retour vers une réponse sûre et lisible lorsque la génération est contaminée.
4. Fallback conversationnel réécrit en langage naturel.
5. Compréhension explicite de demandes comme « où part mon argent ? ».
6. Réponse courte et humaine pour ce type de demande, avec les principaux postes de dépense et une proposition de poursuivre.
7. Réduction des blocs techniques systématiques sur les questions financières simples.

## 5. Principe conversationnel cible

Comprendre d’abord la demande, répondre comme une interlocutrice, puis n’exposer que les informations utiles à la personne.

Les kernels, scores, plans, permissions, contraintes, preuves techniques et identifiants restent des éléments de runtime. Une réponse interne ne doit jamais devenir une réponse utilisateur simplement parce qu’un fournisseur IA a généré ou recopié le contexte.

## 6. Organisation documentaire

Le dépôt contenait un grand nombre de README historiques à la racine, avec des versions allant de V4 à V5.11.

Le nettoyage regroupe les README historiques et les documents de chapitre qui traînaient à la racine dans docs/readme/.

Le README principal reste volontairement à la racine comme porte d’entrée du dépôt.

Les README appartenant réellement à un module autonome restent dans leur dossier afin de préserver leur contexte local.

## 7. Vérification automatique du réveil

Une route protégée /api/lia/runtime/p4-verify est désormais planifiée à 21:00 UTC. Elle vérifie la fenêtre P4 de 20:00 UTC, confirme l’exécution du job et la présence d’un réveil dans lia_autonomous_wakes, puis écrit un événement de vérification. En cas d’absence de preuve, une notification système est créée dans NEXORA.

Cette vérification ne déclenche aucune action financière et ne modifie aucune permission.

## 8. Critères de validation

- conversation regression : obligatoire
- détection des sorties internes : obligatoire
- fallback humain : obligatoire
- demande « où part mon argent ? » : réponse dédiée
- typecheck : obligatoire
- build production : obligatoire
- régression P4 : obligatoire
- aucune modification de permission financière
- aucun retrait de garde-fou

## 9. Verdict

P4 : prêt pour preuve E2E, mais pas encore déclaré prouvé.

Conversation LIA : défaut identifié et correction intégrée.

Documentation : nettoyage engagé, avec séparation entre README principal, historique et documentation locale des modules.