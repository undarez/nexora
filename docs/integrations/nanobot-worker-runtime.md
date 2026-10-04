# NEXORA — Nanobot Worker Runtime Contract

## Scope

This chapter turns the Nanobot production-isolation contract into a persistent NEXORA control-plane registry.

NEXORA owns identity, policy, autonomy, approval, goals, runs and audit. Nanobot remains an external delegated runtime.

## Worker registry

The table lia_nanobot_workers stores only control-plane metadata:

- NEXORA user / LIA agent / organization binding;
- runtime credential identifier;
- isolated worker key;
- environment and lifecycle state;
- worker endpoint;
- opaque config/workspace references;
- session namespace;
- workspace restriction flag;
- concurrency and timeout limits;
- heartbeat and failure state.

No Nanobot API secret or plaintext NEXORA runtime credential is stored in this table.

The table is RLS-enabled and inaccessible to anon/authenticated; server-side control-plane code uses the Supabase secret key.

## Runtime topology

NEXORA → worker registry → isolated Nanobot endpoint → Nanobot MCP Authorization (nbk1...) → NEXORA /api/mcp → runtime credential verification → short-lived execution context → Policy Engine / Executor.

A production worker must have a unique config path, unique workspace, unique session/runtime state, a credential bound to the same NEXORA principal, a dedicated endpoint or authenticated tenant-aware gateway, workspace restriction enabled, bounded concurrency/timeout and health/restart supervision.

Nanobot documents separate config and workspace selectors for isolated instances, including separate sessions, cron data and runtime state. See the official multiple-instance and configuration documentation.

## Important limitation

This registry does not provision OS processes or containers. Vercel remains the stateless NEXORA control plane. A separate worker supervisor must create, start, restart and health-check Nanobot instances and populate this registry.

Until a ready worker is registered, NEXORA must not silently route production traffic to a shared Nanobot instance.

## Health

The worker supervisor should heartbeat frequently enough to detect stale workers and transition provisioning → ready after health/MCP checks, ready → draining before shutdown, ready → error after repeated failures, error → ready after recovery, and any state → disabled when governance disables the worker.

A heartbeat proves liveness only; it never grants authorization. Every MCP request still requires the NEXORA runtime credential and policy checks.

## Acceptance criteria

- A worker row cannot be reused across NEXORA principals.
- A credential is bound to exactly one worker.
- No plaintext credential is persisted.
- No worker endpoint is selected without a matching authenticated NEXORA principal.
- Shared production runtime fallback is disabled.
- Worker health is observable independently from chat success.
