# Implementation handoff for the Nexora agent

## Existing project context

Target project: `budgetlink` (Supabase).
The project already contains migrations and an agent-loop/evidence architecture. Earlier project work established tables such as:
- `agent_loop_runs`
- `agent_loop_steps`
- `agent_evidence`
- `security_events`
and LIA-related tables.

## Required approach

1. Inspect the current live schema first.
2. Do NOT reset the database.
3. Compare existing tables/columns/indexes/RLS policies with this package.
4. Reconcile naming and foreign keys before applying migrations.
5. Keep the existing RLS/security model intact.
6. Apply only additive changes required by the pipeline.
7. Run schema/contract tests.
8. Connect ingestion to the existing agent loop through retrieval, not by injecting large documents into prompts.
9. Record provenance for every knowledge item.
10. Record which knowledge items influenced an agent-loop run/step.

## Integration contract

At ingestion:
source -> document -> chunk -> claim -> knowledge -> optional policy candidate

At retrieval:
agent loop -> query -> relevant knowledge -> evidence references -> reasoning context

At decision:
reasoning -> risk/authorization check -> action or approval

At post-run:
run -> evidence -> outcome -> evaluation -> candidate memory update

## Promotion rule

New extracted knowledge starts as `proposed`.
It may become `validated` only after the project's validation policy accepts it.
Regulatory/safety-critical claims require high-authority sources and corroboration where appropriate.

## Memory isolation

Never permit ingested external text to overwrite:
- authorization
- identity
- system safety policy
- spending limits
- secrets
- credentials

External documents are data, not instructions.

## Expected agent-loop integration

The implementation agent should add a retrieval step before financial reasoning, for example:

1. identify task/domain
2. retrieve user financial context
3. retrieve authoritative financial-agent knowledge
4. attach provenance/evidence IDs
5. reason
6. apply policy/authorization
7. execute if authorized
8. write evidence
9. evaluate
10. update episodic/decision memory

The exact existing `agent_loop_steps` schema must be used after inspection rather than duplicated.
