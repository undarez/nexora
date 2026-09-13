# NEXORA V5.08.38 — LIA Prospective + Email Experience

## Objectif
Continuité du chapitre LIA prospective et industrialisation des emails NEXORA.

## Emails
- Confirmation d'adresse email Supabase Auth avec contenu NEXORA.
- Magic link NEXORA.
- Réinitialisation de mot de passe NEXORA.
- Invitation Entreprise.
- Reconnexion bancaire 90 jours.
- Alerte de sécurité.
- Route de renvoi de confirmation.

## Sécurité
Les emails d'authentification restent gérés par Supabase Auth. Les emails transactionnels passent par une fonction serveur et peuvent utiliser Resend via `RESEND_API_KEY`. Aucun secret n'est exposé au navigateur.

## Configuration production
Configurer le SMTP/domaine d'envoi dans Supabase Auth et copier les modèles `supabase/email-templates/*.html` dans Email Templates. Pour les emails transactionnels, définir `RESEND_API_KEY` et `NEXORA_EMAIL_FROM` côté serveur.
