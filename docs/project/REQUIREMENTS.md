# NEXORA — Requirements Baseline — Cycle 1

## Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-001 | Converse naturally with the user | Must |
| FR-002 | Convert a user goal into a bounded plan | Must |
| FR-003 | Select and invoke governed tools | Must |
| FR-004 | Use Skills as reusable procedures | Must |
| FR-005 | Execute bounded Loops | Must |
| FR-006 | Store and retrieve governed memory/knowledge | Must |
| FR-007 | Evaluate execution results | Must |
| FR-008 | Recover from defined failures and retry safely | Must |
| FR-009 | Record execution telemetry and audit events | Must |
| FR-010 | Support human approval gates | Must |
| FR-011 | Support model routing and fallback | Should |
| FR-012 | Support multi-agent delegation under policy | Should |
| FR-013 | Support local/hybrid model execution where already designed | Should |

## Non-functional requirements

- Security by design.
- Least privilege.
- Explicit policy boundaries.
- Deterministic controls around probabilistic model output.
- Idempotent or otherwise safe retry behaviour.
- Observable execution.
- Traceability from requirement to implementation and test.
- Clear failure modes.
- Reproducible tests.
- Production-oriented documentation.

## Exclusions

- PC-local control.
- Stream Deck.
- Hardware automation.
- Features belonging to the separate improvement project.

## Acceptance rule

A requirement is not considered complete because code exists. It requires an implementation reference, test evidence and an acceptance result.
