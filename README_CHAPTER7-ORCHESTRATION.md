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
