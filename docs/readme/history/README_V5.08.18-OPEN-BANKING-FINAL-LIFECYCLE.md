# NEXORA V5.08.18 — Open Banking final lifecycle closure

## Objectif
Finaliser le cycle Open Banking côté produit et entreprise sans créer de page bancaire supplémentaire.

## Changements
- `/api/banking/connections` est désormais workspace-aware pour les espaces entreprise, avec contrôle de membre actif et privilèges owner/admin pour la révocation.
- Les connexions personnelles restent strictement scoped à l'utilisateur et aux lignes `workspace_id IS NULL`.
- Le cockpit Entreprise affiche les connexions Open Banking et permet reconnexion / révocation.
- La révocation entreprise appelle d'abord le fournisseur puis révoque localement les comptes et la connexion. En cas d'échec fournisseur, la révocation locale n'est pas exécutée.
- Le callback Powens retourne vers `/entreprise` lorsqu'une connexion appartient à un workspace entreprise.
- Le moteur de synchronisation réconcilie l'état fournisseur après import afin de ne pas rétablir à tort une connexion en `active` lorsqu'une réauthentification est requise.
- Les rappels 90 jours sont déjà intégrés à `refresh_financial_notifications`; le rafraîchissement est déclenché à l'ouverture de la cloche de notifications.

## Politique produit
Toute autorisation bancaire active reçoit `reconnect_due_at = consent_granted_at + 90 jours`. Les rappels sont J-30, J-14, J-7, J-1 puis expiré. À échéance, la synchronisation est bloquée et la connexion passe en `needs_reauth`.

## Principe de sécurité
Aucun secret bancaire ou token fournisseur n'est exposé au client. Les actions de connexion, reconnexion, gestion et révocation restent server-side.
