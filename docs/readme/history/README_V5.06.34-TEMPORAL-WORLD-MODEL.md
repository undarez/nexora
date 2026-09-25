# NEXORA v5.06.34 — Temporal World Model Kernel

Adds bounded temporal semantics to the descriptive World Model.

## Capabilities
- classifies knowledge nodes as current, future, expired, or undated relative to an `asOf` timestamp;
- derives bounded temporal validity windows for graph relations;
- preserves provenance and existing contradiction semantics;
- exposes temporal world-model output from `/api/lia/knowledge-graph`;
- never promotes time status into truth, memory, authorization, or execution.

## Safety invariants
- expired does not mean false;
- future does not mean true;
- undated is not current by default;
- contradictions are not silently resolved;
- temporal modeling cannot authorize financial writes.

## Validation
`npm run lia:temporal-world-model`
