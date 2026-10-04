# NEXORA — Nanobot Production Isolation Contract

## Purpose

NEXORA authenticates the human user and remains the authority for identity, policy, autonomy, approval and audit. Nanobot is a delegated execution runtime.

A production deployment MUST NOT use one shared Nanobot workspace/configuration for multiple NEXORA users when that runtime can access NEXORA MCP tools.

## Required topology

`NEXORA user`
→ `NEXORA authenticated session`
→ `tenant/user-scoped Nanobot instance`
→ `Nanobot MCP Authorization header`
→ `NEXORA /api/mcp`
→ `runtime credential verification`
→ `short-lived execution context`
→ `Policy Engine / Executor`

The Nanobot instance is the isolation boundary. The `session_id` field alone is not an authorization boundary.

## Per-user instance requirements

Each user/tenant instance must have:

- a distinct Nanobot config path;
- a distinct Nanobot workspace;
- distinct session/runtime state;
- a distinct NEXORA runtime credential;
- a distinct gateway/API endpoint or an authenticated tenant-aware proxy that preserves this isolation;
- `tools.restrictToWorkspace=true` where filesystem tools are enabled;
- explicit concurrency and timeout limits;
- health and restart supervision.

Nanobot documents separate `--config` and `--workspace` paths as the supported mechanism for isolated instances.

## Credential lifecycle

The NEXORA runtime credential is a bootstrap credential, not a financial permission.

NEXORA maps it server-side to:

- user ID;
- LIA agent ID;
- organization ID.

The credential can be revoked. It must never be accepted with a caller-supplied `userId` or organization identifier.

After credential verification, NEXORA mints a short-lived execution context containing the effective identity and autonomy ceiling. MCP tool execution remains subject to the normal Policy Engine, Decision Gate, Human Gate and executor controls.

## Forbidden deployment

Do not deploy:

- one Nanobot workspace shared by all NEXORA users;
- one static NEXORA MCP bearer token shared by all users;
- user identity supplied in the chat body and trusted by MCP;
- a Nanobot subagent with permissions greater than its parent execution;
- direct financial writes from Nanobot that bypass NEXORA MCP/executor governance.

## Acceptance test

A deployment is considered isolated only when all of these are demonstrated:

1. User A can resume their Nanobot session.
2. User B receives a different workspace/config/runtime state.
3. User A's runtime credential is rejected for User B's NEXORA identity.
4. A revoked credential cannot mint a new execution context.
5. An execution context with a mismatched agent or organization is rejected.
6. Nanobot cannot execute a governed NEXORA tool after the Policy Engine denies it.
7. A child task cannot increase the parent's autonomy ceiling.
8. NEXORA can correlate the Nanobot session with the NEXORA goal/run.

## Operational note

The OpenAI-compatible Nanobot API supports `session_id`, but session separation is conversation state isolation, not authorization. The authorization boundary remains the isolated runtime instance plus its NEXORA credential.

See the Nanobot v0.3.5 multiple-instance documentation before production rollout.
