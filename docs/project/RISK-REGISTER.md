# NEXORA — Risk Register

| ID | Risk | Impact | Probability | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|
| R-001 | Agent gains unintended authority | Critical | Medium | Policy boundary + permission gate | Project owner | Open |
| R-002 | Retry causes duplicate side effects | High | Medium | Idempotency + execution journal | Development | Open |
| R-003 | Model output bypasses policy | Critical | Medium | Deterministic policy checks outside model | Security | Open |
| R-004 | Memory learns incorrect information | High | Medium | Evidence/provenance + candidate governance | Development | Open |
| R-005 | Loops run without useful progress | High | Medium | Max iterations/runtime/cost/retries | Runtime | Open |
| R-006 | CI/deployment regression | High | Medium | Required checks before merge | DevOps | Open |
| R-007 | Financial and generic runtime boundaries blur | Critical | Medium | Explicit domain boundary tests | Architecture | Open |
| R-008 | Scope creep | Medium | High | Frozen charter + change governance | Project owner | Open |
| R-009 | Documentation diverges from code | Medium | Medium | Traceability review at release | Project owner | Open |
| R-010 | Sensitive data leaks into logs | Critical | Medium | Redaction + audit policy + tests | Security | Open |

## Risk rule

Any Critical risk without a documented mitigation and verification path blocks release.
