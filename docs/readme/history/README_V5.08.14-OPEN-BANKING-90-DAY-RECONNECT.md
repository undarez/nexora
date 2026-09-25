# NEXORA V5.08.14 — 90-Day Open Banking Reconnection

NEXORA impose désormais une reconnexion bancaire tous les 90 jours calendaires, sur le modèle produit demandé.

- `consent_granted_at` : date de la dernière autorisation réussie.
- `reconnect_due_at` : échéance NEXORA = +90 jours.
- rappel in-app à J-30, J-14, J-7 et J-1 ; notification urgente après échéance.
- une connexion échue passe à `needs_reauth` et aucune synchronisation n'est exécutée.
- la reconnexion passe par le flux provider existant, sans identifiants bancaires côté NEXORA.
- `consent_expires_at` reste la date d'expiration remontée par le provider ; elle est contrôlée séparément.
- l'historique financier local reste conservé pendant la reconnexion/réauthentification.

Cette politique produit est volontairement plus stricte que la durée PSD2/provider lorsque celle-ci est supérieure : elle répond à la règle UX demandée pour NEXORA.
