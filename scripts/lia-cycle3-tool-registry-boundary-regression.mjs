import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const registry = readFileSync("src/lib/agent-runtime/tool-registry.ts", "utf8");
const adapter = readFileSync("src/lib/agent-runtime/financial-tool-adapter.ts", "utf8");
const executor = readFileSync("src/lib/agent-runtime/executor.ts", "utf8");
const definition = readFileSync("src/lib/agent-runtime/tool-definition.ts", "utf8");
const architecture = readFileSync("docs/project/ARCHITECTURE-TARGET.md", "utf8");

const financialTools = [
  "get_financial_snapshot",
  "get_budget_status",
  "get_cashflow",
  "get_wealth_snapshot",
  "get_forecast",
  "search_transactions",
  "save_financial_insight",
];

assert.match(architecture, /Financial domain[\s\S]*remain domain-specific and must not be implicitly granted to the generic agent runtime/);
assert.match(definition, /export type AgentToolDefinition/);

for (const tool of financialTools) {
  assert.doesNotMatch(registry, new RegExp(`name: "${tool}"`), `generic registry must not define financial capability ${tool}`);
  assert.match(adapter, new RegExp(`name: "${tool}"`), `financial adapter must define ${tool}`);
}

assert.match(executor, /getAgentTool\(call\.name\) \?\? getFinancialAgentTool\(call\.name\)/);
assert.match(executor, /executeFinancialAgentTool\(supabase, userId, call\.name, args/);
assert.doesNotMatch(executor, /case "get_financial_snapshot"/);
assert.doesNotMatch(executor, /case "get_budget_status"/);
assert.doesNotMatch(executor, /case "get_cashflow"/);
assert.doesNotMatch(executor, /case "get_wealth_snapshot"/);
assert.doesNotMatch(executor, /case "get_forecast"/);
assert.doesNotMatch(executor, /case "search_transactions"/);
assert.doesNotMatch(executor, /case "save_financial_insight"/);

console.log("PASS Cycle 3: financial capabilities are domain-owned and generic registry remains domain-neutral");
