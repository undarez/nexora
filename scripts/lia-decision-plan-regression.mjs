import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("src/app/api/lia/chat/route.ts", "utf8");
const orchestration = readFileSync("src/lib/lia/decision-plan-orchestration.ts", "utf8");

assert.match(route, /buildAndPersistLiaDecisionPlan/);
assert.doesNotMatch(route, /buildLiaDecisionPlan\(/);
assert.doesNotMatch(route, /persistLiaDecision\(/);
assert.doesNotMatch(route, /routeLiaQuestion\(/);

assert.match(orchestration, /buildLiaDecisionPlan\(/);
assert.match(orchestration, /persistLiaDecision\(/);
assert.match(orchestration, /routeLiaQuestion\(/);
assert.match(orchestration, /buildLiaDecisionPlan\(/);
assert.doesNotMatch(orchestration, /NextResponse|createClient\(\)/);
assert.doesNotMatch(orchestration, /\.from\(["'](?:accounts|transactions|bank_accounts|budgets|goals|forecasts|financial_[^"']*)["']\)/);

console.log("PASS LIA decision-plan boundary: route delegates planning/persistence and facade owns procedure routing without financial authority.");
