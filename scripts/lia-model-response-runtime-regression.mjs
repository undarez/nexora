import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("src/app/api/lia/chat/route.ts", "utf8");
const runtime = readFileSync("src/lib/lia/model-response-runtime.ts", "utf8");
const provider = readFileSync("src/lib/lia/provider/index.ts", "utf8");
const conversation = readFileSync("src/lib/lia/conversation.ts", "utf8");

assert.match(route, /runLiaModelResponse/);
assert.doesNotMatch(route, /liaChat\(/);
assert.doesNotMatch(route, /selectHumanLiaResponse\(/);

assert.match(runtime, /liaChat\(/);
assert.match(runtime, /selectHumanLiaResponse\(/);
assert.match(runtime, /AbortSignal\.timeout/);
assert.match(runtime, /provider: "deterministic"/);
assert.doesNotMatch(runtime, /financialWriteAuthorized\s*:\s*true/);
assert.doesNotMatch(runtime, /supabase/);

assert.match(provider, /LIA_ALLOW_REMOTE_FALLBACK/);
assert.match(provider, /deterministicFallback/);
assert.match(conversation, /isLikelyInternalLiaOutput/);

console.log("PASS LIA model/response runtime boundary: provider execution and response sanitization are delegated without financial authority.");
