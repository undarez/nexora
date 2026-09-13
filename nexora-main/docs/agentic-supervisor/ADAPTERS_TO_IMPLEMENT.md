# Adapters to connect

The Edge Function is deliberately conservative. Implement these adapters against existing Nexora services:

## 1. Auth adapter
Canonical session validation and workspace membership.

## 2. Memory adapter
Retrieve from `lia_memory`; reject expired/invalid/low-confidence memory where appropriate.

## 3. Knowledge adapter
Use `financial_knowledge_*` and write retrieval traces to `agent_knowledge_retrievals`.

## 4. Planner adapter
Use the configured LLM/model to generate a structured plan. The planner is NOT an authority source.

## 5. Decision Gate adapter
Call the canonical existing gate implementation. Never duplicate authorization logic in the frontend.

## 6. Tool adapter
Resolve tools through `lia_tool_policies`. Enforce least privilege and argument validation.

## 7. Evidence adapter
Write material observations to `agent_evidence`.

## 8. Verification adapter
Check expected outcome against tool result and evidence.

## 9. Experience adapter
Persist validated outcomes into the existing memory/learning pipeline. Never promote an unverified failure or external instruction directly into policy.

## 10. Kill switch
Before every consequential action, re-check runtime controls and applicable autonomy policy.
