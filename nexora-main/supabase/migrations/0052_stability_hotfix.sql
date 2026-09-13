-- v5.02.1: stability hotfix marker.
-- No destructive schema changes. The application now degrades gracefully when
-- cognitive/action/notification migrations have not yet reached the database.
-- Apply all migrations through 0051 normally; this migration is intentionally
-- schema-neutral so it is safe to apply after the existing chain.
comment on schema public is 'Gérer Finance — v5.02.1 stability hotfix applied';
