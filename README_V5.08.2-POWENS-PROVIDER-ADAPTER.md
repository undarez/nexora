# NEXORA V5.08.2 — Powens Provider Adapter

## Objectif
Préparer le premier adaptateur Open Banking réel de NEXORA pour la France/Europe, sans coupler le moteur bancaire au fournisseur.

## Fournisseur ciblé
Powens est utilisé comme premier adaptateur parce que sa documentation actuelle décrit un flux Connect Webview, une API de comptes/transactions et une infrastructure DSP2 en Europe. Le fournisseur reste optionnel et désactivé tant que les variables serveur ne sont pas présentes.

## Variables serveur
```env
POWENS_DOMAIN=your-domain.biapi.pro
POWENS_CLIENT_ID=...
POWENS_CLIENT_SECRET=...
NEXORA_VAULT_KEY=...
```

Ne jamais exposer ces variables en `NEXT_PUBLIC_*`.

## Flux
1. L'utilisateur clique sur Connecter une banque.
2. NEXORA crée/récupère un contexte utilisateur Powens côté serveur.
3. Le jeton permanent est chiffré dans le coffre L3.
4. NEXORA obtient un code temporaire et redirige vers le Connect Webview Powens.
5. Powens revient sur `/api/banking/powens/callback`.
6. NEXORA associe la connexion externe à la connexion locale via un état aléatoire à usage de corrélation.
7. Le Banking Sync Engine récupère comptes/transactions côté serveur.
8. Les données sont normalisées avant persistance.
9. LIA ne reçoit ensuite que la projection du Financial Data Gateway.

## Sécurité
- aucun mot de passe bancaire n'est reçu par NEXORA;
- aucun token Powens n'est envoyé au navigateur;
- le token Powens est chiffré AES-256-GCM dans le coffre;
- le provider n'est enregistré que si les trois variables Powens sont présentes;
- les appels API sont `no-store`;
- aucun paiement n'est implémenté par cet adaptateur;
- le flux reste limité aux données de comptes/transactions.

## Limite volontaire
La synchronisation actuelle récupère jusqu'à 1000 transactions par appel. La pagination complète et les webhooks Powens seront traités dans la prochaine itération avant toute mise en production.
