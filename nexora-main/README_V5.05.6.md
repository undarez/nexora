# NEXORA v5.05.6 — Reliability & Error Handling

Objectif : éviter les écrans bloqués et les erreurs silencieuses.

## Changements
- `src/lib/http/fetch-json.ts` : fetch JSON borné dans le temps, erreurs réseau/timeout/HTTP normalisées.
- `global-error.tsx` : récupération de l'interface au niveau global.
- `(protected)/error.tsx` : récupération d'une page protégée sans perdre la session.
- Hermes reçoit désormais un timeout par défaut de 45 s si aucun signal n'est fourni (`HERMES_TIMEOUT_MS` configurable).
- Ollama reçoit désormais un timeout par défaut de 120 s si aucun signal n'est fourni (`OLLAMA_TIMEOUT_MS` configurable).
- Pilotage : erreurs de chargement et d'actions remontées proprement à l'utilisateur, états de chargement libérés sur erreur, réponses JSON invalides signalées.

## Validation
Une validation syntaxique ciblée des fichiers modifiés doit être effectuée. Le build Next.js complet n'est pas déclaré validé dans cette version tant que les dépendances du projet ne sont pas installées dans l'environnement de validation.
