# NEXORA — Nanobot Worker Supervisor Contract

## Purpose

NEXORA is the control plane. A separate Worker Supervisor owns the lifecycle of external Nanobot processes or containers.

Vercel/Next.js must never become the persistent Nanobot runtime.

## Supervisor API

NEXORA calls:

`POST /v1/workers/provision`

with an authenticated supervisor token and the following contract:

- NEXORA principal: userId, agentId, organizationId;
- unique workerKey;
- unique workspaceRef/configRef/sessionNamespace;
- `workspaceIsolation=per-user`;
- `restrictToWorkspace=true`;
- bounded concurrency and timeout;
- NEXORA MCP URL;
- one freshly-issued NEXORA runtime credential.

The supervisor returns:

- endpointUrl;
- workspaceRef;
- configRef.

The runtime credential is transmitted only during provisioning and is never persisted by NEXORA in plaintext.

## Required Supervisor behavior

For each request:

1. create a dedicated Nanobot config;
2. create a dedicated Nanobot workspace;
3. create isolated runtime/session state;
4. configure MCP Authorization with the supplied NEXORA credential;
5. restrict filesystem tools to that workspace;
6. enforce the requested concurrency and timeout ceilings;
7. expose only the authenticated worker endpoint;
8. run health and MCP readiness checks;
9. restart unhealthy workers;
10. report lifecycle/heartbeat state to NEXORA.

## Lifecycle

`provisioning → ready → draining → disabled`

Failure path:

`ready → error → restart → ready`

NEXORA remains the authority for authorization. A healthy worker is not automatically authorized to perform an action.

## Secret handling

The supervisor token is an infrastructure secret and must live only in server-side environment configuration.

The Nanobot runtime credential is user/agent/organization scoped. It must never be sent to the browser, logged, committed, or stored in plaintext.

## Current deployment contract

Required server environment:

- `NEXORA_NANOBOT_SUPERVISOR_URL`
- `NEXORA_NANOBOT_SUPERVISOR_TOKEN`
- optional `NANOBOT_WORKER_ENVIRONMENT`
- optional `NEXORA_MCP_URL`

Until these are configured and a worker supervisor is deployed, production Nanobot delegation remains unavailable rather than falling back to a shared worker.

