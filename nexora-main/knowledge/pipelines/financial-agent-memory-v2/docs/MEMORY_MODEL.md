# Memory model

Semantic: stable general knowledge.
Financial: authorized user-specific financial facts.
Episodic: events observed during runs.
Decision: why recommendations/actions were selected and their outcomes.
Policy-candidate: extracted candidate rules; non-authoritative until validated.
Policy/authorization: protected control plane, not ordinary knowledge.

Persistent knowledge is versioned. Rollback restores the last validated version without deleting provenance/history.
