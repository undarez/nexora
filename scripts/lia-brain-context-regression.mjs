import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("src/app/api/lia/chat/route.ts", "utf8");
const orchestration = readFileSync("src/lib/lia/brain-context-orchestration.ts", "utf8");

assert.match(route, /loadLiaBrainContextForTurn/);
assert.doesNotMatch(route, /buildLiaBrainContext\(/);
assert.doesNotMatch(route, /agentKey:\s*"lia:financial-brain"/);

assert.match(orchestration, /buildLiaBrainContext\(/);
assert.match(orchestration, /lia:financial-brain/);
assert.match(orchestration, /recordAgentLoopStep/);
assert.doesNotMatch(orchestration, /NextResponse|createClient\(\)/);
assert.doesNotMatch(orchestration, /\.from\(["'](?:accounts|transactions|bank_accounts|budgets|goals|forecasts|financial_[^"']*)["']\)/);

console.log("PASS LIA brain-context boundary: route delegates governed brain loading and its loop telemetry.");
