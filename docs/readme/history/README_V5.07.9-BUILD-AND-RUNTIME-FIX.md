# NEXORA v5.07.9 — Build & Runtime Fix

Correctifs après validation locale v5.07.8.

## Correctifs
- `agent_loop_steps.step_order` est entier : suppression des stepOrder décimaux.
- `CognitivePhase` conserve `context` et les appels utilisent des phases compatibles.
- Le contexte passé au moteur déterministe est casté explicitement sans exposer de données brutes au provider.
- Compatibilité de l'endpoint admin avec la forme actuelle de `liaProviderConfig`.
- Le dossier historique `work/` est exclu de la release afin d'éviter qu'un ancien arbre TypeScript soit compilé.
- Version applicative : 0.1.60.

## Supabase
La table `public.financial_secure_vault_items` de la migration 0083 a été appliquée sur le projet `budgetlink`.

## Après installation
```powershell
npm run build
npm run dev
```
