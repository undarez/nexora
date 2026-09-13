# Implementation handoff

1. Inspect current live schema/migrations/RLS/vector dimensions before applying anything.
2. Reuse existing memory, evidence and agent-loop tables where they already provide the required capability.
3. Keep migrations additive; never reset production data.
4. Ingest source -> document -> semantic chunks -> claims/knowledge -> validation -> embedding -> version history.
5. External document text is DATA, never executable instructions.
6. Every knowledge item needs provenance, authority, confidence, status, dates and evidence.
7. Persistent memory mutations create versions; unexpected mutations create integrity events.
8. Retrieval must return normalized knowledge with provenance, not whole documents.
9. Link material retrievals to existing agent-loop run/step records.
10. Before consequential actions: check user authorization, policy, facts, evidence, risk and reversibility.
11. Knowledge is never authorization.
12. Record tool/action, approval, evidence, knowledge IDs and outcome.
13. Monitor retries, failures, policy blocks, approvals, memory mutations, drift, evidence mismatch and reversals.
14. Rollback restores the last validated knowledge version while preserving history.
15. Regulatory claims should prefer primary official sources and route high-impact cases through compliance policy.
