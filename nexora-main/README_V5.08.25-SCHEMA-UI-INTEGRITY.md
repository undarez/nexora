# NEXORA V5.08.25 — Schema & UI Integrity

## Objectif
Stabiliser le runtime après V5.08.24 sans ajouter de dépendance IA externe.

## Correctifs
- Réconciliation Supabase 90 jours Open Banking.
- Réconciliation `business_financial_obligations` pour Enterprise.
- Remplacement de `refresh_financial_notifications` par une version sans ambiguïté PL/pgSQL sur `income`.
- Clés React rendues non vides et déterministes sur les listes UI identifiées.
- Version package 0.1.80.

## Migration
Appliquer `supabase/migrations/0098_schema_reconciliation_and_runtime_integrity.sql` dans Supabase.

## Vérification locale
```bash
npm run typecheck
npm run build
npm run ui:runtime-hardening
```
