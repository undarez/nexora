# Chapter 7 — Autonomie gouvernée et orchestration

## Étape 1 — Execution Bridge

Le Chapitre 7 transforme l'orchestrateur existant en véritable boucle d'exécution observable :

`objectif → plan borné → étape gouvernée → outil → vérification → résultat → étape suivante`.

### Correction de l'orchestrateur

La page `/orchestration` appelait bien `/api/lia/orchestrate/run`, mais l'interface affichait le statut du **run** comme s'il s'agissait du statut de la **step**. Elle pouvait aussi afficher une étape fantôme lorsque le plan réel contenait moins d'étapes que le budget demandé.

Le runtime respecte désormais le `max_steps` persisté du plan et n'ajoute au trace que les étapes réellement exécutées. L'interface affiche le statut réel de chaque étape ainsi que son output vérifié.

### Architecture Chapter 7

- Mission Planner / orchestration plan
- Steps gouvernées et bornées
- Runtime d'exécution
- Policy / Human Gate
- Outils read-only autorisés
- Vérification post-exécution
- Recovery / retry
- Trace observable
- Résultat exploitable par l'étape suivante

### Garde-fous conservés

- aucune écriture financière sensible automatique
- Human Gate pour les actions sensibles
- Policy Engine obligatoire
- budget d'étapes borné
- vérification avant validation d'une étape
- recovery en cas d'échec
- aucune modification automatique des permissions

### Régressions

- `npm run lia:orchestrator-runtime`
- `npm run lia:orchestration`

Cette première tranche de Chapter 7 ne remplace pas les mécanismes Chapter 5/6 : elle les relie à l'exécution observable de l'orchestrateur.

## Étape 2 — Task Graph gouverné

La table `lia_orchestration_steps` porte maintenant des métadonnées de graphe : dépendances, lane d'agent et politique d'exécution bornée. Une étape ne peut pas être exécutée tant que ses dépendances déclarées ne sont pas terminées.

Les lanes actuelles sont descriptives et gouvernées : `lia:finance-observer`, `lia:research`, `lia:relationship`, `lia:human-gate` et `lia:orchestrator`. Elles ne donnent aucune permission supplémentaire.

## Étape 3 — Replanning dynamique gouverné

Le runtime ne s'arrête plus systématiquement sur un échec de vérification terminal.

Lorsqu'une étape échoue après épuisement de son recovery, LIA peut reconstruire le graphe restant avec un budget strict de 2 replans maximum par mission. La procédure ayant échoué est exclue du nouveau plan afin d'éviter de répéter mécaniquement la même voie.

Le replan conserve :
- les étapes déjà terminées ;
- la traçabilité de l'échec et de sa cause ;
- la version du graphe (plan_version) ;
- le compteur de replans (replan_count) ;
- l'historique borné des replans ;
- les dépendances et lanes d'agents gouvernées ;
- les mêmes règles de Policy / Human Gate.

Un replan ne crée aucune permission et n'autorise aucune écriture financière sensible.
## Étape 4 — Handoffs multi-agents structurés

Chaque étape possède une lane d'agent gouvernée. Le runtime transmet désormais au step suivant un handoff structuré contenant l'agent source, l'agent cible, l'étape source, l'étape cible et les éléments d'évidence disponibles.

Les sorties vérifiées produisent également des evidence_refs bornées. Elles servent de contexte de travail et de traçabilité ; elles ne donnent aucune permission supplémentaire.

Le principe est :
`agent A → sortie vérifiée → handoff/evidence → agent B → vérification`.

Les lanes restent soumises aux mêmes Policy Gates, Human Gates et limites d'exécution.
## Étape 5 — Budget d'autonomie multidimensionnel

Chaque mission d'orchestration possède maintenant un budget séparé pour plusieurs ressources :
- étapes exécutables ;
- appels outils ;
- retries ;
- replans ;
- recherches externes ;
- écritures mémoire.

Les compteurs sont atomiques côté Supabase et indépendants du niveau d'autonomie utilisateur. L'épuisement d'une dimension bloque la mission au lieu de laisser le runtime continuer.

Valeurs par défaut de mission : 5 étapes, 8 appels outils, 4 retries, 2 replans, 3 recherches externes et 5 écritures mémoire.

Ce budget ne donne aucune permission. Il constitue une limite de consommation supplémentaire au-dessus de Policy, Permission et Human Gate.