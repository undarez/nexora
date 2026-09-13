# NEXORA V5.08.5 — Stripe Customer / SEPA / Refunds

Cette itération transforme la fondation Stripe en couche de paiement exploitable sans confondre Open Banking et paiements.

## Ajouts
- Customer Stripe par utilisateur NEXORA.
- SetupIntent pour enregistrer un moyen de paiement réutilisable, avec SEPA Direct Debit comme capacité européenne ciblée.
- Enregistrement contrôlé des PaymentMethods côté serveur.
- Remboursements Stripe avec idempotence et contrôle de propriété du PaymentIntent.
- Registres Supabase `stripe_customers`, `stripe_payment_methods`, `stripe_refunds` avec RLS.

## Routes
- `POST /api/payments/stripe/customer`
- `POST /api/payments/stripe/setup-intent`
- `POST /api/payments/stripe/payment-method`
- `POST /api/payments/stripe/refund`
- `POST /api/payments/stripe/payment-intent`
- `POST /api/payments/stripe/webhook`

## Sécurité
Les opérations Stripe sont server-side. Les PaymentMethod IDs reçus du client sont vérifiés contre le Customer Stripe appartenant à l'utilisateur avant persistance. Les remboursements ne sont possibles que pour un PaymentIntent déjà enregistré pour cet utilisateur.

SEPA Direct Debit est un moyen de paiement, pas un mécanisme d'agrégation Open Banking. Stripe documente le schéma SEPA Core et les mandats nécessaires.

## Positionnement
Stripe SEPA Direct Debit sert ici au paiement/débit autorisé d'un compte SEPA. Il ne remplace pas le connecteur d'Open Banking utilisé pour récupérer les comptes et transactions bancaires.
