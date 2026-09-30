# NEXORA — Project Charter — Cycle 1 Cadrage

## 1. Purpose

NEXORA is being developed as a personal agent runtime. The objective is to provide a governed agent capable of conversation, planning, tool use, research, memory, evaluation, recovery and progressive learning.

**Cycle 1 does not implement new agent capabilities. It establishes the project frame required to build them safely and measurably.**

## 2. Scope correction

The following are explicitly OUT OF SCOPE for this project:
- PC-local control as a project objective.
- Stream Deck integration.
- Any hardware/desktop-control enhancement belonging to another project.

These subjects must not appear in NEXORA V1 planning, milestones, acceptance criteria or KPIs.

## 3. V1 objective

Deliver a production-oriented, observable and governed Personal Agent Runtime in which:
1. a user expresses a goal;
2. the system understands it;
3. a plan is produced;
4. tools/skills are selected;
5. permissions are checked;
6. work is executed;
7. results are evaluated;
8. failures can be recovered;
9. useful learning is persisted under governance.

## 4. Definition of done

V1 is complete only when the above lifecycle is demonstrable through tests, telemetry, acceptance criteria and documented operating procedures.

## 5. Governance principles

- Human authority remains explicit.
- Permissions are least-privilege.
- High-impact actions require an approval gate.
- Every important action is auditable.
- Loops have bounded iterations, runtime, cost and retries.
- Learning changes governed knowledge, memory, strategies or skills rather than silently changing model weights.
- Every release passes build, tests, verification and security checks.

## 6. Cycle 1 deliverables

- Project charter.
- Requirements baseline.
- Target architecture.
- Governance and responsibility matrix.
- Roadmap.
- Action plan.
- Risk register.
- Test/acceptance framework.
- Anomaly tracking framework.
- Project dashboard.
- Process flow diagrams.
- Child-friendly PowerPoint specification.
