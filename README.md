# NEXORA — Gérer Finance & LIA

NEXORA est l’application personnelle de gestion financière augmentée par IA sur laquelle nous construisons LIA, une assistante capable de comprendre le contexte financier, dialoguer naturellement, analyser des données, utiliser des outils gouvernés et poursuivre des objectifs de manière autonome mais bornée.

> État actuel : branche principale intégrant le chapitre 7 jusqu’à P4.1 — Continuous autonomous operations / live autonomy validation. Le premier réveil E2E réel de LIA reste à observer lors du prochain déclenchement du cron de production.

## 🎯 Ce que fait NEXORA

NEXORA combine quatre niveaux :
- Gestion financière : comptes, transactions, budget, enveloppes, objectifs, trésorerie et projections.
- Intelligence LIA : raisonnement déterministe, recherche contrôlée, mémoire, apprentissage borné, recommandations et explications.
- Architecture agentique : agents spécialisés, orchestrateur/superviseur, exécution par étapes, replanning borné et boucles autonomes.
- Gouvernance : Policy Engine, Human Gate, permissions, budgets d’actions, audit, RLS et séparation stricte entre connaissance, décision et autorisation.

L’objectif n’est pas de créer un chatbot qui récite des données financières. L’objectif est de construire une assistante financière personnelle capable de comprendre une situation, d’expliquer simplement ce qu’elle voit, de proposer des options et d’agir uniquement dans les limites qui lui sont réellement accordées.

## 🧠 LIA

LIA possède deux modes complémentaires :
1. Conversation — discussion naturelle, salutations, questions générales et échanges courts sans charger inutilement le contexte financier.
2. Raisonnement financier — accès contrôlé aux données autorisées, analyse déterministe, recherche éventuelle, recommandation, vérification et traçabilité.

Une règle importante du projet est que LIA doit parler comme une interlocutrice naturelle. Les kernels, JSON, plans internes, contraintes techniques et traces de gouvernance restent internes au runtime et ne doivent pas être exposés à l’utilisateur.

## 🤖 Architecture agentique

Le chapitre 7 fournit actuellement sept familles d’agents spécialisés :
- Copywriting
- SEO
- System Administration
- Data
- Finance
- Mobility
- Research

Le système comprend notamment : Policy Engine et Human Gate ; plafond d’autonomie ; skills autorisés ; budgets d’exécution ; supervisor persistant ; replanning borné ; mémoire de travail ; vérification et reprise adaptative ; boucle P4 ; fiabilité historique utilisée comme limite d’autonomie.

### P4 — Continuous autonomous operations

Le cycle continu peut choisir entre : recover → goal → learn → observe → idle.

La boucle ne peut pas augmenter ses propres permissions, modifier ses politiques de sécurité, activer automatiquement un skill, contourner le Human Gate ou effectuer silencieusement une écriture financière sensible.

## 🔐 Sécurité et gouvernance

NEXORA utilise Supabase/PostgreSQL avec RLS et des opérations serveur privilégiées séparées des opérations utilisateur.

Principes : moindre privilège ; séparation lecture/action ; audit ; preuves avant action ; mémoire comme frontière de sécurité ; contenu externe non fiable par défaut ; validation humaine pour les actions financières sensibles ; aucune connaissance, recommandation ou mémoire ne constitue à elle seule une autorisation.

## 🧱 Stack

- Next.js 16 / React 19
- TypeScript
- Tailwind CSS / shadcn
- Supabase / PostgreSQL
- Vercel
- Open Banking
- MCP
- moteur local ou NEXORA Brain selon la configuration

## 🚀 Développement

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

Régressions LIA importantes :

```bash
npm run lia:chapter7-final
npm run lia:chapter7-p4-continuous
npm run lia:chapter7-p4-verification
npm run lia:conversation
```

## 📚 Documentation

La documentation historique des différentes versions est regroupée dans docs/readme/. Le README principal reste à la racine.

Les documentations spécialisées restent dans leurs dossiers fonctionnels lorsqu’elles font partie d’un module ou d’un pipeline.

Voir également : docs/NEXORA-AI-OS.md, docs/lia/, docs/production/ et knowledge/.

## 🧪 État de validation

Le projet dispose de régressions dédiées pour les kernels cognitifs, la mémoire, les données financières, les agents spécialisés, l’orchestration, la sécurité et les opérations continues.

Un statut Ready ou un build vert ne suffit pas à prouver une exécution autonome réelle. Pour P4, la preuve attendue est une trace complète du cron jusqu’à lia_autonomous_wakes, puis aux exécutions agentiques et à leur vérification.

## 📌 Organisation du dépôt

- src/ — application et runtime
- supabase/ — migrations et configuration base
- scripts/ — régressions et outillage
- docs/ — documentation technique et historique
- knowledge/ — connaissances et skills gouvernés
- brain-runtime/ — runtime du cerveau NEXORA
- android/ — application Android

## ⚠️ Important

NEXORA est un système de gestion financière avec fonctions agentiques. Les fonctionnalités autonomes sont donc conçues avec des limites explicites. Une proposition, un raisonnement ou une information apprise par LIA ne doit jamais être confondu avec une autorisation d’exécuter une opération financière.

## Projet

Dépôt privé de développement. Les informations de version et de déploiement décrivent l’état du projet et ne constituent pas une garantie de disponibilité d’un environnement externe.