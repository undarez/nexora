
## V5.06.18 — Behavioural Supervisor Integration
- Bounded financial supervisor context.
- Behaviour + contextual strategy history are read-only inputs to planning.
- Autopilot now exposes supervisor context without granting action authority.
- Supervisor persistence is additive in `lia_supervisor_runs`.
- Canonical Policy Engine / Decision Gate remain the only authorization boundary.

## V5.06.18 — Behavioural Supervisor Integration
- Bounded financial supervisor context.
- Behaviour + contextual strategy history are read-only inputs to planning.
- Autopilot now exposes supervisor context without granting action authority.
- Supervisor persistence is additive in `lia_supervisor_runs`.
- Canonical Policy Engine / Decision Gate remain the only authorization boundary.

## V5.06.18 — Behavioural Supervisor Integration
- Integrated the Agentic Supervisor implementation package as governed reference material.
- Added a bounded runtime adapter using financial behaviour + contextual strategy history as planning context only.
- Added `/api/lia/supervisor` to create a bounded supervisory run.
- Autopilot now exposes supervisor context without granting action authority.
- Existing `lia_supervisor_runs` foundation is reused; migration 0082 bridges the runtime RPC.
- Canonical Policy Engine / Decision Gate remain the only authorization boundary.
