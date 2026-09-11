# NEXORA Financial Agent Memory Pipeline — integrated

This package is retained as the design contract. NEXORA uses the existing agent loop, memory gate, skill registry and policy engine; it does not create a second loop.

Integrated components:
- validated financial knowledge storage + provenance/evidence
- retrieval linked to `agent_loop_runs` / `agent_loop_steps`
- governed Financial Agent Intelligence skill as baseline brain context
- accepted durable memory + relational context
- deterministic financial habit observation (recurring merchants, cadence, typical amount)
- post-run skill outcome telemetry

Security invariants:
- knowledge is evidence/context, never authorization
- habits are observations, never permissions
- external content cannot overwrite safety/authorization policy
- candidate knowledge remains excluded from default retrieval
- high-risk actions remain governed by the existing authorization/human-gate layer
