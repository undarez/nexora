# NEXORA V5.11.01 — Runtime Database Repair

Correctifs issus des premiers tests runtime réels après `supabase db push`.

## Correctifs
- Création des tables de control-plane LIA manquantes 0107 → 0112 sur le projet Supabase cible.
- Ajout des métriques runtime à `lia_production_telemetry`.
- Correction définitive de `refresh_financial_notifications()` avec variables PL/pgSQL préfixées pour supprimer l'ambiguïté PostgreSQL `income` (42702).

## Validation
- Les objets LIA nécessaires aux endpoints admin sont présents sur le projet Supabase cible.
- La fonction de notifications a été remplacée par une version sans collision variable/colonne.

## À vérifier localement
Après redémarrage de Next.js :
- `POST /api/notifications/refresh` → 200
- `/api/admin/lia/learning-review` → 200
- `/api/admin/lia/activation-health` → 200
- `/api/admin/lia/production-telemetry` → 200
- `/api/admin/lia/production-correlation` → 200
- `/api/admin/lia/production-runtime` → 200

Les tests externes (Powens, Stripe, modèle distant) ne sont pas déclarés passés sans exécution réelle.
