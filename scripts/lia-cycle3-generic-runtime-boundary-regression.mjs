import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const executor = readFileSync("src/lib/agent-runtime/executor.ts", "utf8");
const adapter = readFileSync("src/lib/agent-runtime/financial-tool-adapter.ts", "utf8");
const architecture = readFileSync("docs/project/ARCHITECTURE-TARGET.md", "utf8");

assert.match(architecture, /Financial domain[\s\S]*remain domain-specific and must not be implicitly granted to the generic agent runtime/);
assert.doesNotMatch(executor, /financial-data-gateway/, "generic executor must not import the financial gateway");
assert.doesNotMatch(executor, /case "get_financial_snapshot"/, "generic executor must not own financial tool handlers");
assert.doesNotMatch(executor, /case "get_budget_status"/, "generic executor must not own budget data access");
assert.doesNotMatch(executor, /case "get_cashflow"/, "generic executor must not own cashflow data access");
assert.doesNotMatch(executor, /case "get_wealth_snapshot"/, "generic executor must not own wealth data access");
assert.match(executor, /executeFinancialAgentTool/, "generic executor must delegate financial tools through the domain adapter");
assert.match(adapter, /buildLiaFinancialProjection/, "financial adapter must own the financial projection dependency");
assert.match(adapter, /case "get_financial_snapshot"/, "financial adapter must own financial handlers");
assert.match(adapter, /case "get_budget_status"/, "financial adapter must own budget access");
assert.match(adapter, /case "get_cashflow"/, "financial adapter must own cashflow access");
assert.match(adapter, /case "get_wealth_snapshot"/, "financial adapter must own wealth access");

console.log("PASS Cycle 3: generic executor is decoupled from direct financial tool handlers");
