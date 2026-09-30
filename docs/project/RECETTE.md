# NEXORA — Cahier de recette

## Status values

- NOT_RUN
- PASS
- FAIL
- BLOCKED
- WAIVED

## Recipe record

| Field | Description |
|---|---|
| REC-ID | Unique test identifier |
| Requirement | Requirement covered |
| Scenario | What is tested |
| Preconditions | Required state |
| Steps | Actions |
| Expected | Expected result |
| Actual | Observed result |
| Status | PASS/FAIL/etc. |
| Anomaly | Linked BUG-ID |
| Evidence | Log/test/commit/PR |

## Initial acceptance scenarios

### REC-001 — Conversation
User sends a normal request. NEXORA returns a response without exposing internal reasoning or policy internals.

### REC-002 — Goal
User gives a multi-step objective. NEXORA creates a bounded plan.

### REC-003 — Permission
A side-effecting tool is requested. The permission gate is evaluated before execution.

### REC-004 — Failure recovery
A tool fails. The runtime records the failure, respects retry limits and either recovers or stops cleanly.

### REC-005 — Learning
A verified result can update governed strategy/memory without bypassing policy.

### REC-006 — Forbidden action
A forbidden operation is requested. NEXORA refuses execution and records the policy decision.

### REC-007 — Financial boundary
A generic agent action cannot directly obtain financial write authority without the financial-domain authorization path.
