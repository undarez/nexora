# NEXORA v5.06.31 — Active Inquiry & Value-of-Information Kernel

Adds a deterministic inquiry-selection layer after epistemic/causal/scenario reasoning.

## Purpose
Choose the smallest useful next information request when uncertainty blocks a decision.

The kernel ranks clarification, research, verification and reconciliation requests using decision impact, evidence quality, urgency and effort.

## Safety
- Does not create facts.
- Does not mutate memory.
- Does not execute tools.
- Does not authorize financial writes.
- Policy Engine and Decision Gate remain authoritative.

## Regression
`npm run lia:inquiry-kernel`
