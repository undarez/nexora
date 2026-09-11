# NEXORA V5.08.17 — Enterprise Operations

## Objectif
Étendre le cockpit Entreprise sans créer de nouvelle page financière.

## Ajouts
- échéances financières d'entreprise (TVA, impôts, social, fournisseurs, paie, emprunts, autres)
- table `business_financial_obligations` avec RLS par workspace
- API `/api/enterprise/obligations`
- composant intégré à `/entreprise`
- les échéances restent distinctes des transactions bancaires : elles représentent des sorties prévues et ne sont jamais comptabilisées comme dépenses réelles tant qu'une transaction n'existe pas.
- version projet 0.1.76

## Suite
La prochaine passe doit clôturer l'Open Banking : audit provider Powens, callbacks, synchronisation, webhooks, 90 jours, révocation compte/connexion, cohérence des états et tests de bout en bout.
