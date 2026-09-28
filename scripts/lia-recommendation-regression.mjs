import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("src/app/api/lia/chat/route.ts", "utf8");
const orchestration = readFileSync("src/lib/lia/recommendation-orchestration.ts", "utf8");

assert.match(route, /buildLiaRecommendationContext/);
assert.match(route, /formatLiaRecommendationContext/);
assert.doesNotMatch(route, /buildLiaRecommendation\(/);
assert.doesNotMatch(route, /formatLiaRecommendation\(/);

assert.match(orchestration, /buildLiaRecommendation\(/);
assert.match(orchestration, /formatLiaRecommendation\(/);
assert.match(orchestration, /humanApprovalRequired/);
assert.doesNotMatch(orchestration, /NextResponse|createClient\(\)/);
assert.doesNotMatch(orchestration, /\.from\(["'](?:accounts|transactions|bank_accounts|budgets|goals|forecasts|financial_[^"']*)["']\)/);

console.log("PASS LIA recommendation boundary: deterministic recommendation construction and formatting are delegated without authority.");
