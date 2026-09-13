# NEXORA — templates email Supabase Auth

Ces modèles sont la source éditoriale officielle des emails d'authentification NEXORA.
Ils doivent être copiés dans **Supabase → Authentication → Email Templates** (Confirmation, Magic Link, Reset Password, Invite User, Change Email) avec le SMTP/domaine d'envoi de production configuré.

Variables Supabase utilisées : `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .TokenHash }}`, `{{ .RedirectTo }}` selon le template.

Les emails transactionnels NEXORA (invitation Entreprise, reconnexion bancaire, alertes de sécurité) utilisent `src/lib/email/templates.ts` et peuvent être envoyés via `RESEND_API_KEY` avec `src/lib/email/resend.ts`.

Ne jamais mettre `RESEND_API_KEY` dans le navigateur ni dans le dépôt.
