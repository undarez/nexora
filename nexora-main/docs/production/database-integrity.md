# V5.10.02 — Database integrity

Review all migrations and live schema before production: foreign keys, unique constraints, indexes, nullable fields, RPC contracts, triggers, orphan rows and RLS policies.

RLS is the authority boundary. Service-role functions must be explicitly documented. Run migration checks and a staging query-plan review for high-traffic financial reads.
