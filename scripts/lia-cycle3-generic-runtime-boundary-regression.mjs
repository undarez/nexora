import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const executor = readFileSync("src/lib/agent-runtime/executor.ts", "utf8");
const architecture = readFileSync("docs/project/ARCHITECTURE-TARGET.md", "utf8");

assert.match(architecture, /Financial domain[\s\S]*remain domain-specific and must not be implicitly granted to the generic agent runtime/);
assert.match(executor, /buildLiaFinancialProjection/, "current generic executor still imports the financial gateway");
assert.match(executor, /case "get_financial_snapshot"/, "current generic executor still owns a financial tool handler");
assert.match(executor, /case "get_budget_status"/, "current generic executor still owns budget data access");
assert.match(executor, /case "get_cashflow"/, "current generic executor still owns cashflow data access");
assert.match(executor, /case "get_wealth_snapshot"/, "current generic executor still owns wealth data access");

console.log("PASS Cycle 3 audit: generic executor financial-boundary findings reproduced");
