# NEXORA v5.06.32 — Knowledge Synthesis Kernel

Adds a bounded synthesis layer between evidence/research and memory consolidation.

## Guarantees
- preserves evidence IDs and source provenance;
- distinguishes supported, tentative, conflicted and insufficient states;
- rewards source independence and freshness;
- surfaces conflicts instead of silently reconciling them;
- never invents missing evidence;
- never validates truth or mutates durable memory;
- never executes tools or authorizes financial writes;
- Memory Governance and Decision Gate remain authoritative.

## Regression
`npm run lia:knowledge-synthesis`
