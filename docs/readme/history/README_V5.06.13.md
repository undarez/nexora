# NEXORA V5.06.13 — Financial Agent Memory + Brain Context + Habits

Integrated from `NEXORA-FINANCIAL-AGENT-MEMORY-PIPELINE-v1.0.0`.

## Added
- Financial Agent Memory Pipeline schema (sources, documents, chunks, knowledge, evidence, retrievals, conflicts).
- Governed lexical retrieval of validated financial-agent knowledge.
- Brain Context loader combining the governed Financial Agent Intelligence skill, validated knowledge, accepted durable memory, consented relational context and learned financial habits.
- Deterministic financial habit detection from repeated transaction patterns (cadence, typical amount, occurrences, confidence).
- Agent-loop provenance records for retrieved knowledge.
- Skill outcome telemetry through the existing governed skill registry.
- Autonomous learning bridge: corroborated validated research can populate the dedicated financial-agent knowledge memory.
- Admin ingestion endpoint: `/api/lia/knowledge/ingest`; new items enter as `proposed` and require governed validation.

## Safety
Knowledge and habits are context/evidence only. They never grant authorization. Existing Policy Engine, autonomy limits and human gates remain authoritative.

## Validation
- `lia-financial-memory-regression`: PASS
- `lia-financial-agent-intelligence-regression`: PASS
- `lia-autonomous-orchestration-regression`: PASS
- TypeScript syntax/transpile checks for changed files: PASS
- Full Next build was not executed in the packaging environment because project dependencies/node_modules are not installed.

## Supabase
Migration `0077_financial_agent_memory_pipeline` has been applied to `budgetlink`.
No database reset was performed.
