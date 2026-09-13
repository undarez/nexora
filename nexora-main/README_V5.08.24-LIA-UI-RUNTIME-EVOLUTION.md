# NEXORA V5.08.24 — LIA UI & Runtime Evolution

## Corrections intégrées

- Suppression de la dépendance active à Hermes : routes, client et statut retirés de l'application.
- Nettoyage des textes LIA : plus de préambule technique à la conversation utilisateur ; un simple « hello » reçoit une réponse naturelle.
- Landing hero : suppression du grand mark N/orbite isolé et repositionnement du téléphone, de la bulle Nexo et de la carte financière pour éviter les chevauchements.
- Notifications : panneau ancré au viewport pour éviter le clipping dans la sidebar.
- Correction préventive des clés React vides/dupliquées sur les timelines et listes dynamiques.
- Veille réservée à l'administrateur avec trois fonctions : recherche de sources fiables, ingestion de connaissances candidates, création de Skills/Loops candidats.
- Validation explicite des connaissances administrateur via migration `0097_admin_knowledge_validation.sql`.
- Orchestration : lorsqu'aucun Use Case validé ne correspond, LIA construit maintenant une procédure candidate bornée au lieu de s'arrêter.
- Runtime : la page expose davantage la progression, les événements et l'apprentissage du runtime.
- Control Plane NEXORA natif : l'administration suit jobs, états et événements sans dépendre d'un control plane externe.
- Analytics admin : message de diagnostic plus explicite lorsque la migration analytics n'est pas disponible.
- Paramètres : clarification du rôle de la mascotte et séparation nette entre personnalisation visuelle et garde-fous financiers.

## Sécurité / gouvernance

Les nouvelles connaissances et Skills restent candidats jusqu'à validation. La connaissance ne donne aucune autorisation financière. Les écritures sensibles restent soumises aux garde-fous existants.

## Validation

Le script `npm run ui:runtime-hardening` vérifie 10 invariants structurels de cette version.
