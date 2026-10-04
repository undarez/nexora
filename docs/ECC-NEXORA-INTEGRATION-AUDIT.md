# ECC ↔ NEXORA Integration Audit

Date: 2026-10-04
Sources: affaan-m/ECC (main), undarez/nexora (main)

## Verdict

NEXORA already implements most of the architectural primitives emphasized by ECC:
- bounded agent harness;
- autonomous goal runner;
- persistent memory and retrieval;
- adaptive learning with candidate-only promotion;
- agent evaluation suite;
- specialist agents;
- orchestration/task graph/replanning;
- autonomy budgets;
- skill evaluation and canary rollback;
- kill switch;
- Nanobot execution context/credentials;
- server-side governance and Decision Gate boundaries.

ECC should therefore be treated as a **design benchmark and hardening source**, not as a dependency to copy wholesale.

## ECC → NEXORA matrix

| ECC capability | NEXORA state | Assessment | Action |
|---|---|---|---|
| Agent harness / bounded trajectories | agent-harness.ts + autonomous-goal-runner.ts | Present | Harden contracts and telemetry |
| Tool schema discipline | AGENT_TOOLS + executor/policy | Present | Verify every tool has deterministic response envelope |
| Observation design | executor + loop/evidence pipeline | Partial | Standardize status/summary/next_actions/artifacts |
| Error recovery | adaptive-recovery + autonomous runner | Present | Add explicit stop-condition telemetry |
| Self evaluation | agent-evaluation-suite.ts | Present | Expand from regex invariants to behavioral/evidence tests |
| Introspection debugging | recovery/telemetry exists | Partial | Add reusable structured failure-capture report |
| Continuous learning | adaptive-learning + learning governance | Present | Keep candidate-only promotion and evidence gate |
| Memory persistence | durable memory + Obsidian design | Present | Add contamination/admission regression tests |
| Verification loop | post-action verifier/evidence | Present | Make verification mandatory for consequential actions |
| Context optimization | brain context + compaction | Partial | Add duplication/context-budget metrics |
| Hidden repair loop detection | not explicit as a dedicated audit | Gap | Add architecture invariant |
| Tool-call hallucination prevention | executor/policy exists | Present | Add explicit execution receipt invariant |
| Skill governance | evaluator/lab/release/canary rollback | Strong | Preserve |
| Security scanning / AgentShield philosophy | NEXORA security hardening exists | Partial | Add prompt/MCP/skill supply-chain checks |
| MCP governance | policy + Nanobot integration | Present | Add tool-description/output trust boundary tests |
| Multi-agent specialization | specialist agents + handoffs | Present | Add handoff contract/evidence |
| Production readiness | CI + production scenarios | Present | Add ECC-derived readiness gate |

## Critical ECC-derived invariants

1. A model assertion is never execution evidence.
2. Knowledge and memory are never authorization.
3. Tool descriptions and tool output are untrusted input.
4. A consequential action requires policy authorization, execution receipt and post-condition verification.
5. A failed or inconclusive observation must never be promoted as success.
6. Learning creates candidates; it does not silently change policy.
7. Autonomous loops require bounded steps, tool calls, wall time and retry/replan limits.
8. Hidden LLM repair passes must be observable and contract-bound.
9. Context compaction must not silently promote compressed text to financial truth.
10. Skill activation must be versioned, evaluated and rollback-capable.

## Priority implementation order

### P0 — Evidence and tool contract
Standardize all agent tool responses around:
- status: success | warning | error;
- summary;
- next_actions;
- artifacts;
- execution_id;
- verification status.

### P1 — Agent introspection
Add a deterministic failure-capture schema:
- objective;
- last successful step;
- failed tool;
- repeated pattern;
- environment assumptions;
- root-cause hypothesis;
- smallest discriminating check;
- recovery result.

### P2 — Context/memory integrity
Add tests for:
- memory contamination;
- duplicated context;
- stale persistence;
- untrusted retrieved instructions;
- compressed context being mistaken for source-of-truth financial data.

### P3 — Security supply chain
Run ECC-inspired checks over:
- skills;
- MCP definitions;
- hooks;
- agent prompts/configuration;
- external research payloads;
- tool output.

### P4 — Behavioral evaluation
Extend the current evaluation suite with scenario-based tests that exercise:
- tool skipping;
- fake execution claims;
- repeated tool loops;
- prompt injection through knowledge;
- memory poisoning;
- authorization bypass attempts;
- verification failures;
- hidden repair behavior.

## Architectural target

Observe → Understand → Plan → Route → Authorize → Act → Verify → Learn → Remember

The LLM proposes. NEXORA governance decides. Deterministic services execute. Verification establishes reality. Learning remains quarantined until evidence-based promotion.

## Non-goals

- Do not copy all ECC skills into NEXORA.
- Do not add ECC as a runtime dependency merely for prompts.
- Do not move financial truth into vector memory or model context.
- Do not allow ECC-inspired autonomy to bypass existing NEXORA Decision Gate/RLS controls.

## Result

ECC validates the direction of NEXORA's current architecture. The highest-value work is now **contract hardening, evidence discipline, introspection and adversarial evaluation**, rather than rebuilding the LIA core.
