# NEXORA — Governance

## Roles

| Responsibility | Owner |
|---|---|
| Product direction | Project owner |
| Architecture | Project owner + architecture review |
| Implementation | Development workflow |
| Security | Security review + automated controls |
| Acceptance | Project owner |
| Release decision | Project owner |
| Incident decision | Project owner |
| Agent autonomy policy | Explicit policy/configuration |

## Decision classes

### Class A — Read-only / low impact
May be automated when permitted.

### Class B — External side effect
Requires an explicit tool permission and audit trail.

### Class C — Financial / sensitive / irreversible
Requires an explicit human approval gate unless a separately approved policy says otherwise.

### Class D — Forbidden
The runtime must reject the action.

## Change governance

Every architectural change follows:
Proposal → impact analysis → implementation → tests → review → merge → verification → documentation update.

## Release governance

No release is accepted when:
- critical tests fail;
- security boundaries are broken;
- audit evidence is missing;
- acceptance criteria are not met;
- known critical anomalies remain unexplained.

## Learning governance

Learning may update governed memory, knowledge, strategies, Skills or procedures. It must not silently alter model weights or bypass policy.
