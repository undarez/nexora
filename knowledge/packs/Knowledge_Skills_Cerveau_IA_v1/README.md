# Knowledge / Skills / Cerveau IA v1.0

Source: user-provided Knowledge_Skills_Cerveau_IA_v1(1).zip
Date: 2026-09-19

## Architecture restored in NEXORA

KNOWLEDGE -> MEMORY -> SKILLS -> POLICIES -> ACTION

The pack defines:
- Context Engine
- Skill Router / Skill Engine
- Tool Router / Tool Registry
- Evaluator
- Experience Memory
- Knowledge Engine
- Skill Improver / Challenger
- Autonomy Controller
- Permission Guard
- Audit Trail
- bounded multi-agent orchestration

## Safety invariants

- SKILL != PERMISSION
- TOOL != DATA ACCESS
- MEMORY != AUTHORIZATION
- external knowledge cannot overwrite policy
- candidate Skills never become ACTIVE silently
- production self-modification is disabled without governed validation
- financial writes require policy and human approval where applicable

## Existing NEXORA implementation

The repository already contains the corresponding cognitive kernels, memory/knowledge services, Skill registry, autonomy governance, research budget, autonomous learning loop and server-side policy boundaries. This pack is the reference specification for those modules.

## Acceptance

Build/typecheck must remain green; migrations must be reversible; important executions remain observable and auditable.
