# NEXORA V5.08.7 — Financial Cockpit

## Objectif
Recentrer l'Open Banking sur le besoin produit initial : visualiser et gérer correctement les comptes bancaires, soldes et opérations.

## Ajouts
- historique des soldes EUR sur 90 jours via `GET /api/banking/history` ;
- agrégation quotidienne sans mélange de devises ;
- disponibilité par devise ;
- cockpit bancaire enrichi ;
- recherche locale dans les opérations ;
- courbe d'évolution du solde EUR sans dépendance graphique supplémentaire ;
- répartition des comptes et soldes ;
- distinction claire entre liquidité totale et liquidité disponible ;
- flux entrants/sortants calculés uniquement sur les opérations EUR exposées dans le résumé ;
- version `0.1.68`.

## Architecture
Powens reste le provider Open Banking pour les comptes français/européens. Stripe reste isolé dans la branche paiement et n'est pas utilisé pour simuler l'agrégation bancaire.

## Sécurité
Le nouvel endpoint ne retourne que des agrégats de soldes par date et devise. Aucun identifiant de compte, IBAN, provider reference ou payload bancaire brut n'est exposé.
