# NEXORA / LIA — Cycle 2 Stabilisation Baseline — 30 septembre 2026

## Objet

Record the stabilisation gate after the current LIA architectural extraction sequence and PR #53 model/response runtime audit.

## Evidence reviewed

- main baseline: `6bbd07f324ab8a39d887691416cee083690cd1c8`
- PR #53: model/response runtime isolation, merged into main
- Existing extraction sequence: conversation/chat runtime, financial context, cognitive kernel, session/goal, brain context, memory/knowledge, recommendation and research/evidence orchestration
- Existing LIA P4 audit: `docs/audits/2026-09-25-lia-p4-conversation-audit.md`
- Current P4 regression checks: bounded wake/runtime, governed controls, recovery priority, active goals, governed learning, bounded proactive observation, cron authentication, hourly Vercel LIA dispatch and specialist reliability controls

## Validation result

The post-merge main baseline is the current stabilisation reference. The model/response runtime correction is integrated, the deterministic fallback remains authoritative when generated content is rejected or unavailable, and the LIA chat path delegates conversation handling and bounded tool execution to dedicated runtime modules.

The architectural extraction sequence already present on main should not be re-applied from the stale historical `audit/chapter-*` branches. Those branches diverged from the current baseline and are historical work products rather than merge candidates.

## Vercel scheduling

The LIA runtime dispatch remains hourly in `vercel.json`. The P4 verification job remains daily. This matches the current repository regression contract; changing the runtime dispatch cadence would require a separate architectural decision and regression update.

## Scope / safety

No Cycle 2 change grants the generic runtime financial write authority. Existing policy gates, deterministic controls and audit paths remain part of the architecture.

## Gate decision

Cycle 2 stabilisation baseline: RECORDED.

Next workstream: Cycle 3 — Generic Agent Runtime, beginning with a fresh audit from the current main baseline rather than replaying historical extraction branches.
