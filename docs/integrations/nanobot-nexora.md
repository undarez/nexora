# NEXORA ↔ Nanobot v0.3.5

## Architecture

NEXORA remains the authority for identity, autonomy, policy, goals/runs and audit. Nanobot is an external execution runtime.

```text
NEXORA authenticated user
  ↓
per-user Nanobot runtime credential (static MCP header)
  ↓
NEXORA /api/mcp
  ↓
server-side lookup of the runtime credential
  ↓
short-lived signed execution context (nbx1)
  ↓
Policy Engine + Decision Gate
  ↓
NEXORA tool
```

Nanobot v0.3.5 supports remote HTTP MCP servers with static headers and environment-variable interpolation. It also supports separate config/workspace paths for isolated instances. This makes a per-user/per-tenant Nanobot runtime credential the practical first bridge: Nanobot stores only its own runtime credential, while NEXORA creates a fresh short-lived execution context for each MCP request.

## Provisioning

Authenticated NEXORA users can request one runtime credential:

`POST /api/lia/nanobot/credential`

The plaintext credential is returned once. NEXORA stores only its SHA-256 hash. It can be revoked with:

`DELETE /api/lia/nanobot/credential?id=<credential-id>`

Do not commit the returned credential.

## Nanobot MCP configuration

Use a dedicated Nanobot config/workspace for each NEXORA user or tenant.

```json
{
  "tools": {
    "mcpServers": {
      "nexora": {
        "type": "streamableHttp",
        "url": "https://YOUR_NEXORA_DOMAIN/api/mcp",
        "headers": {
          "Authorization": "Bearer ${NEXORA_MCP_TOKEN}"
        },
        "toolTimeout": 120
      }
    }
  }
}
```

Set `NEXORA_MCP_TOKEN` in the Nanobot runtime environment to the credential issued by NEXORA. Nanobot resolves environment placeholders at startup and keeps the resolved value in memory.

Recommended enabled tools for the first rollout:

```json
[
  "get_financial_snapshot",
  "get_budget_status",
  "get_cashflow",
  "get_wealth_snapshot",
  "get_forecast",
  "search_transactions",
  "search_skills",
  "research_web",
  "create_recommendation"
]
```

Keep `learn_skill` disabled initially. Its NEXORA policy already requires L7 and candidate activation remains separately governed.

## Nanobot API client

NEXORA now exposes a bounded server-side Nanobot adapter at:

`POST /api/lia/nanobot/chat`

Required server environment:

- `NANOBOT_API_URL`
- `NANOBOT_API_KEY`
- `NEXORA_NANOBOT_BRIDGE_SECRET`

The adapter:

- authenticates to Nanobot with its API key;
- propagates a correlation ID;
- isolates the Nanobot session with `session_id`;
- enforces a 5–180 second request timeout;
- caps the response body at 2 MB;
- does not expose Nanobot credentials to the browser;
- falls back deterministically when Nanobot is unavailable.

The Nanobot API itself must remain behind HTTPS and an API key when exposed beyond loopback.

## Isolation rule

Do not run a shared Nanobot workspace for multiple NEXORA users. Use distinct Nanobot config/workspace paths and distinct runtime credentials. The MCP credential is the identity of the Nanobot runtime; it is not a replacement for NEXORA's per-request authorization.

## Current activation status

The adapter and MCP identity boundary are implemented and tested, but the external Nanobot runtime is deliberately not activated automatically. Production activation requires configuring the server secrets and provisioning a per-user Nanobot runtime credential.
