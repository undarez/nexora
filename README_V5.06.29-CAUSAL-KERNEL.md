# NEXORA v5.06.29 — Causal Reasoning Kernel

Adds a deterministic causal-analysis layer after epistemic assessment.

## Purpose
- Distinguishes observation/association from causal candidates.
- Requires temporal ordering before causal interpretation.
- Penalizes confounders and alternative explanations.
- Allows counterfactual reasoning only with strong causal support.
- Never creates facts, mutates memory, executes tools, or authorizes financial writes.
- Policy Engine and Decision Gate remain authoritative.

## Regression
`npm run lia:causal-kernel`

No Supabase migration required.
