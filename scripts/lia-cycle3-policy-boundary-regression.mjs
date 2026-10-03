import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const identity = readFileSync("src/lib/security/agent-identity.ts", "utf8");
const executor = readFileSync("src/lib/agent-runtime/executor.ts", "utf8");
const architecture = readFileSync("docs/project/ARCHITECTURE-TARGET.md", "utf8");
const boundedEngine = readFileSync("src/lib/lia/autonomy/bounded-engine.ts", "utf8");

const domainToolNames = [
  "get_financial_snapshot",
  "get_budget_status",
  "get_cashflow",
  "get_wealth_snapshot",
  "get_forecast",
  "search_transactions",
  "save_financial_insight",
];

assert.match(
  architecture,
  /Financial domain[\s\S]*remain domain-specific and must not be implicitly granted to the generic agent runtime/,
  "architecture target must preserve the generic/domain boundary",
);

assert.match(identity, /export function authorizeAgentExecution/);
assert.doesNotMatch(identity, /POLICIES/);
assert.doesNotMatch(identity, /getAgentPolicy/);

for (const tool of domainToolNames) {
  assert.doesNotMatch(identity, new RegExp(tool), `local security guard must not own financial tool policy: ${tool}`);
}

assert.match(executor, /authorizeAgentExecution\(principal, autonomyLevel\)/);
assert.match(executor, /admin\.rpc\("authorize_lia_tool"/);
assert.match(executor, /p_tool_key: call\.name/);
assert.doesNotMatch(executor, /authorizeAgentTool/);
assert.doesNotMatch(boundedEngine, /getAgentPolicy/);
assert.doesNotMatch(boundedEngine, /from "@\/lib\/security\/agent-identity"/);

console.log("PASS Cycle 3: local security guard is domain-neutral and Supabase owns per-tool authorization");
