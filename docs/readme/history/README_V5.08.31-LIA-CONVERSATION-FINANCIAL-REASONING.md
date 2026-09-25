# NEXORA V5.08.31 — LIA Conversation + Financial Knowledge

## Objectif
Faire de LIA une interlocutrice naturelle tout en renforçant son raisonnement financier avec une base de connaissances validée et sourcée.

## Conversation
Le endpoint `/api/lia/chat` possède désormais une voie conversationnelle légère : les salutations, remerciements, questions de bien-être, au revoir et questions d'identité ne déclenchent pas les lectures financières lourdes.

Exemple :
> Utilisateur : Comment vas-tu ?
>
> LIA : Je vais bien, merci 😊 Je suis prête à t’aider. Et toi, comment vas-tu ?

La petite conversation peut utiliser le provider LIA sans lui transmettre de données financières. Les réponses simples sont déterministes.

## Raisonnement financier
Les demandes financières continuent d'utiliser le pipeline existant : Financial Source of Truth, outils déterministes, mémoire gouvernée, connaissances validées, recherche contrôlée et kernels cognitifs.

## Connaissances ajoutées
Migration `0100_lia_conversation_knowledge_seed.sql` :
- AMF — risque/rendement des actions ;
- AMF — diversification de l'épargne ;
- AMF — vérifications avant investissement ;
- AMF — objectif, horizon et risque ;
- CNIL — minimisation des données dans les systèmes d'IA.

Ces éléments sont insérés comme `validated` avec une provenance source. Ils constituent du contexte documentaire, jamais une autorisation d'action.

## Validation
- `npm run lia:conversation` → 8/8 PASS
- `npm run lia:knowledge` → 9/9 PASS
- `npm run admin:open-banking` → 7/7 PASS
- `npm run enterprise:identity` → 7/7 PASS
- architecture audit → PASS

`npm run typecheck` / `npm run build` doivent être exécutés dans l'environnement du projet après `npm install`, car `node_modules` n'est pas inclus dans l'archive.
