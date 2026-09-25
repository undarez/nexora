# NEXORA V5.08.26 — Enterprise Rebuild

Refonte complète du module Entreprise en cockpit unique, plus simple et moderne.

## Principes
- Réutilise le même socle financier que le tableau de bord particulier via `buildUnifiedFinancialContext`.
- Ne dépend plus de `business_financial_obligations`, ni de l'ancien `buildEnterpriseFinancialContext`.
- Aucun nouvel objet financier spécifique n'est nécessaire pour afficher le cockpit.
- Les données comptables/factures non présentes dans le modèle actuel sont explicitement indiquées comme indisponibles.
- LIA analyse le même contexte financier et reste en proposition pour les actions sensibles.

## Sections
- Vue d'ensemble : revenus, charges, solde des flux, trésorerie.
- Activité : historique 6 mois et principales catégories de dépenses.
- Rentabilité : marge de flux, objectifs et état de la donnée comptable.
- Trésorerie : soldes, disponible, charges fixes et réserve.
- Prévisionnel : budget et projection d'atterrissage.
- Clients/fournisseurs : emplacement préparé sans inventer de données de facturation.
- IA : analyse LIA contextualisée.

## Benchmark fonctionnel
La structure s'inspire du benchmark public Pennylane : cartes KPI, évolution temporelle, analyse des coûts, trésorerie et personnalisation. Elle ne copie ni son interface ni son implémentation.
