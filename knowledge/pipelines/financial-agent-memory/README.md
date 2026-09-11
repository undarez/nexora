# NEXORA — Financial Agent Memory Pipeline v1.0.0

## Objective

This package is the integration layer between:
- `NEXORA-FINANCIAL-AGENT-INTELLIGENCE-v2.0.0`
- Nexora's Supabase project (`budgetlink`)
- the agent loop
- financial-agent memory
- evidence/audit records
- future knowledge enrichment

It is designed to be handed to the implementation agent in the Nexora project.

## Important

This is an integration scaffold, not a blind database reset. The existing project already has migrations and agent-loop/evidence work. The implementation agent must inspect the live schema and reconcile these migrations with the current migration history before applying them.

The package deliberately uses additive objects and `IF NOT EXISTS` where practical.

## Intended flow

Skill v2
  -> source registry
  -> ingestion
  -> normalized knowledge
  -> validation
  -> financial knowledge memory
  -> retrieval during agent loop
  -> agent decision
  -> evidence
  -> evaluation
  -> promotion/update

## Core rule

Retrieved knowledge never grants authorization.

Knowledge can inform:
- reasoning
- planning
- recommendations
- risk classification
- test generation

Only the existing authorization/policy layer can authorize financial actions.

## Package contents

- `supabase/migrations/` additive database schema
- `supabase/functions/` Edge Function skeletons
- `schemas/` JSON contracts
- `config/` pipeline policy
- `docs/` implementation instructions
- `tests/` SQL/contract test ideas
