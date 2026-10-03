# Cycle 3 — Policy / Authorization Boundary Audit

Date: 2026-09-30

## Scope

Audit the remaining security coupling after the generic tool-registry extraction.

Target:
- `src/lib/security/agent-identity.ts`
- `src/lib/agent-runtime/executor.ts`
- live Supabase `authorize_lia_tool` / `lia_tool_policies`

Out of scope:
- PC local
- Stream Deck
- unrelated financial product features

## Finding

The local security module contained a second per-tool policy registry.

It enumerated financial capabilities and also generic capabilities, with local autonomy and approval rules. The runtime then performed this local check before calling the Supabase Policy Engine.

The live Supabase Policy Engine already owns `lia_tool_policies` and evaluates the requested `p_tool_key`. The two sources had drifted:

- local `learn_skill` / `learn_use_case`: minimum autonomy L7;
- live Supabase policy: minimum autonomy L1;
- live Supabase also contains tool policies absent from the local registry, including `get_application_context`, `create_cron_job`, `propose_dynamic_workflow` and other capabilities.

This created a false extensibility boundary: adding a policy-backed tool in Supabase could still be rejected by the application before the authoritative policy engine was reached.

## Correction implemented

`agent-identity.ts` now exposes only a generic execution guard:

1. verify the expected LIA principal identity;
2. validate that the autonomy value is an integer in the supported L0–L8 range.

It no longer contains per-tool names, autonomy thresholds, approval flags, or risk metadata.

`executor.ts` now uses the generic guard and delegates per-tool authorization to:

`authorize_lia_tool(p_agent_id, p_user_id, p_organization_id, p_tool_key, p_autonomy_level)`

The executor still fails closed when the Supabase Policy Engine is unavailable or denies the requested tool.

## Security invariant

The LLM never authorizes itself.

Authorization remains server-side and is evaluated by the Supabase Policy Engine. The local layer verifies principal identity and structural autonomy validity; the database layer decides whether a specific tool is enabled, allowed at the current autonomy level, or requires human approval.

The generic runtime therefore does not need to know whether a tool is financial, research, learning, workflow, or another future domain.

## Regression guard

Added:

`scripts/lia-cycle3-policy-boundary-regression.mjs`

The guard verifies that:
- the local security module has no per-tool policy registry;
- financial tool names are absent from the local authorization layer;
- the executor uses the generic guard;
- the executor still calls the Supabase authorization RPC with the requested tool key.

## Build regression found and corrected

The first deployment of this boundary refactor exposed a consumer dependency in `src/lib/lia/autonomy/bounded-engine.ts`, which still imported the removed `getAgentPolicy` helper. That helper was part of the old per-tool local policy registry and therefore could not be restored without reintroducing the architectural coupling.

The bounded autonomy selector was corrected to use the tool definition risk/approval metadata only as a capability preselection. Final authorization remains in `executeAgentTool` through the Supabase Policy Engine. A regression assertion now prevents `bounded-engine.ts` from importing the removed policy registry.

## Remaining point to audit

The next security/runtime audit should verify that tool definitions, policy rows, and execution adapters cannot diverge silently. In particular, a policy-enabled tool should have a resolvable definition before execution, and a tool definition should not imply authorization by itself.
