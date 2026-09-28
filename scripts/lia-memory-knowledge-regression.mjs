import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("src/app/api/lia/chat/route.ts", "utf8");
const orchestration = readFileSync("src/lib/lia/memory-knowledge-orchestration.ts", "utf8");

assert.match(route, /loadLiaDurableMemory/);
assert.match(route, /proposeLiaMemoryFromTurn/);
assert.doesNotMatch(route, /retrieveLiaMemories\(/);
assert.doesNotMatch(route, /createMemoryCandidate\(/);
assert.doesNotMatch(route, /recordFinancialMemoryVersion\(/);

assert.match(orchestration, /retrieveLiaMemories\(/);
assert.match(orchestration, /createMemoryCandidate\(/);
assert.match(orchestration, /recordFinancialMemoryVersion\(/);
assert.doesNotMatch(orchestration, /NextResponse|createClient\(\)/);
assert.doesNotMatch(orchestration, /\.from\(["'](?:accounts|transactions|bank_accounts|budgets|goals|forecasts|financial_[^"']*)["']\)/);

console.log("PASS LIA memory/knowledge boundary: durable memory retrieval and candidate proposal are delegated and remain governed.");
