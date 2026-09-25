# NEXORA V5.08.3 — Stripe Foundation

## Décision d'architecture

Stripe est ajouté comme couche de paiement, sans remplacer le connecteur Open Banking bancaire existant.

### Pourquoi

Stripe Financial Connections fournit l'accès aux données de comptes financiers, soldes et transactions, mais sa disponibilité contractuelle pour les utilisateurs finaux est actuellement limitée aux États-Unis. Les conditions Stripe indiquent explicitement que, pour Financial Connections, l'entité contractante est Stripe, Inc. lorsque le particulier réside aux États-Unis.

Pour NEXORA ciblant la France, on ne doit donc pas présenter Stripe comme le fournisseur d'agrégation bancaire européen. Powens reste le provider `bank_data` pour cette fonction.

Stripe peut en revanche être utilisé pour les paiements et flux associés, notamment PaymentIntents et les moyens de paiement SEPA pris en charge par Stripe.

## Modifications V5.08.3

- ajout des capacités explicites aux adapters bancaires ;
- callback bancaire rendu configurable par provider ;
- le endpoint `/api/banking/connect` refuse proprement un provider sans flux de connexion ;
- ajout d'une fondation Stripe server-side sans SDK : `src/lib/payments/stripe-server.ts` ;
- ajout de `POST /api/payments/stripe/payment-intent` ;
- `STRIPE_SECRET_KEY` reste strictement côté serveur ;
- aucune clé Stripe secrète n'est exposée au navigateur ;
- version applicative `0.1.64`.

## Variables

```env
STRIPE_SECRET_KEY=sk_test_...
```

Ne jamais placer `STRIPE_SECRET_KEY` dans une variable `NEXT_PUBLIC_*`.

## Flux Stripe

Le endpoint PaymentIntent :

1. vérifie l'utilisateur Supabase ;
2. valide le montant en unité mineure ;
3. ajoute l'identifiant utilisateur NEXORA dans les métadonnées ;
4. transmet la requête au backend Stripe ;
5. retourne uniquement la réponse PaymentIntent nécessaire au client.

Les flux Stripe Checkout/Billing et les webhooks seront ajoutés séparément afin de ne pas mélanger paiement, abonnement et agrégation bancaire.

## Open Banking

Le choix est volontairement hybride :

- **Powens** → agrégation bancaire / comptes / soldes / transactions en France/Europe ;
- **Stripe** → paiements et services financiers Stripe compatibles ;
- architecture provider-neutral → remplacement ou ajout futur d'un autre fournisseur sans réécrire le moteur bancaire.

Cette séparation évite de construire une abstraction NEXORA qui prétendrait que tous les fournisseurs offrent les mêmes capacités.
