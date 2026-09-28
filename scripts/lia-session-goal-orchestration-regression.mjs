import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("src/app/api/lia/chat/route.ts", "utf8");
const orchestration = readFileSync("src/lib/lia/session-goal-orchestration.ts", "utf8");

assert.match(route, /initializeLiaSessionGoalState/);
assert.match(route, /createOrResumeLiaGoal/);
assert.match(route, /updateLiaGoalState/);
assert.match(route, /persistLiaSessionTurn/);
assert.match(route, /learnExplicitLiaRelationalFeedback/);

assert.doesNotMatch(route, /await\s+getOrCreateCognitiveSession\(/);
assert.doesNotMatch(route, /await\s+touchCognitiveSession\(/);
assert.doesNotMatch(route, /await\s+recordCognitiveSessionTurn\(/);
assert.doesNotMatch(route, /await\s+updateCognitiveSessionContext\(/);
assert.doesNotMatch(route, /advanceGoalLifecycle\(/);
assert.doesNotMatch(route, /persistGoalLifecycle\(/);
assert.doesNotMatch(route, /createGoalLifecycle\(/);
assert.doesNotMatch(route, /await\s+recordExplicitRelationalFeedback\(/);
assert.doesNotMatch(orchestration, /NextResponse|createClient\(\)|from\(["'](accounts|transactions|bank_accounts|financial)[^"']*["']\)/);

assert.match(orchestration, /financialWriteAllowed|financial/);
assert.match(orchestration, /consentedPersonalization/);

console.log("PASS LIA session/goal orchestration boundary: route delegates lifecycle/session persistence and facade has no financial authority.");
