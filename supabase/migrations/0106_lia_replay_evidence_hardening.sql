-- V5.08.52: replay evidence hardening. Raw candidate/baseline content is not persisted.
comment on table public.lia_replay_runs is 'Replay evidence only. Baseline/candidate columns contain summaries and SHA-256 fingerprints, never raw model/user content. Replay cannot validate or activate a capability.';
