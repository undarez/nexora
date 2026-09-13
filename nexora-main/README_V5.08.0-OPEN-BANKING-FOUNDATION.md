# NEXORA V5.08.0 — Open Banking Foundation

Cette version prépare l'intégration Open Banking sans activer de fournisseur réel.

## Principes
- architecture provider-neutral ;
- aucun identifiant bancaire accepté par NEXORA ;
- aucune fausse synchronisation ;
- lecture seule par défaut ;
- les connexions existantes restent gérées par `bank_connections` ;
- `/api/banking/connect` échoue fermé tant qu'un adaptateur n'est pas enregistré ;
- `/api/banking/sync` n'invente aucune donnée et retourne `503` sans adaptateur ;
- `/api/banking/connections` expose uniquement les métadonnées nécessaires à l'interface.

## Prochaine étape
Implémenter un adaptateur Open Banking conforme au prestataire choisi, puis ajouter le callback OAuth/consentement et la synchronisation idempotente des comptes et transactions.
