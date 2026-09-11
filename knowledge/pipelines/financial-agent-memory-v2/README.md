# NEXORA — Financial Agent Memory Pipeline v2.0.0

Integration layer between NEXORA-FINANCIAL-AGENT-INTELLIGENCE-v2.0.0 and Nexora's existing Supabase memory/agent-loop architecture.

## v2
- provenance-first knowledge
- separated semantic/episodic/financial/decision/policy-candidate memory
- immutable/versioned history
- memory integrity and drift monitoring
- conflict handling
- authority-aware retrieval
- agent behaviour telemetry
- decision gates
- regulatory reasoning hooks
- evidence linkage
- rollback/deprecation
- adversarial/regression tests

## CRITICAL
Do NOT reset or replace the existing Nexora Supabase schema. Inspect the live project and reconcile this package with existing agent_loop_runs, agent_loop_steps, agent_evidence, security_events, LIA, memory, policy and authorization tables.

Knowledge NEVER grants authorization.
