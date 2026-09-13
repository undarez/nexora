import assert from "node:assert/strict";
import { AgentHarness } from "../src/lib/lia/agent-harness.ts";

const harness = new AgentHarness({ maxSteps: 4, maxToolCalls: 2, maxWallTimeMs: 30_000, maxRepeatedCalls: 1 });
assert.equal(harness.guard("model").allowed, true);
harness.record({ kind: "model", name: "test", ok: true, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), durationMs: 1 });
assert.equal(harness.guard("tool", "read:a").allowed, true);
harness.record({ kind: "tool", name: "read", ok: true, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), durationMs: 1, fingerprint: "read:a" });
assert.equal(harness.guard("tool", "read:a").allowed, false);
assert.equal(harness.state.status, "blocked");
console.log("lia-agent-harness: ok");
