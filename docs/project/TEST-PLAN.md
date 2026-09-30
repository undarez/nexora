# NEXORA — Test Plan

## Test levels

### T0 — Static
TypeScript, lint, formatting and static checks.

### T1 — Unit
Pure functions, policy decisions, planners, evaluators and bounded loop logic.

### T2 — Integration
Runtime + tool registry + persistence + policy boundaries.

### T3 — Security
Authorization, prompt injection resistance, SSRF protections, secret handling, audit integrity and forbidden-action tests.

### T4 — Failure/recovery
Timeout, model failure, tool failure, malformed output, retry limits, duplicate execution and partial completion.

### T5 — Acceptance
User-visible scenarios proving the requirements.

## Evidence

Each accepted requirement must point to:
- implementation location;
- test identifier;
- execution result;
- anomaly if failed;
- acceptance decision.

## Release gate

No Critical or unresolved High defect may be accepted without explicit documented decision.
