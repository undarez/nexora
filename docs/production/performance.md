# V5.10.03 — Query & performance

Measure dashboard, transactions, budgets, Enterprise and LIA routes. Look for N+1 queries, repeated reads, oversized payloads, missing pagination/indexes and unnecessary provider calls.

Targets: monitor P50/P95 latency, error rate, payload size and LIA token/cost telemetry. Optimize only after measurement.

The primary database layer is Supabase; inspect query plans on high-traffic reads.
