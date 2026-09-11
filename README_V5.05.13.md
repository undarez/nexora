# NEXORA v5.05.13 — Budget → Transactions

- La page Transactions récupère les charges fixes actives déclarées dans Budget pour l’utilisateur connecté.
- Une charge peut être ajoutée directement comme transaction négative, avec source `budget_fixed` et catégorie déterministe quand elle est identifiable.
- Protection contre le doublon d’une même charge déjà ajoutée au mois.
- Ajout d’un bloc « Budget sauvegardé » permettant de récupérer et afficher le scénario `budget_scenarios` du mois courant.
- Les enveloppes sauvegardées sont affichées et restent synchronisées avec les affectations de transactions.
