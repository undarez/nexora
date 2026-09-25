import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("src/app/api/lia/chat/route.ts", "utf8");
const brain = readFileSync("brain-runtime/server.py", "utf8");
const autonomous = readFileSync("src/lib/lia/learning/autonomous.ts", "utf8");

assert.match(route, /externalResearchAvailable: Boolean\(research\)/, "self-evaluation must reflect actual research execution");
assert.match(route, /critique\.status !== "blocked"/, "brain outcome must include critique status");
assert.match(route, /evaluation_verdict: selfEvaluation\.evaluation\.verdict/, "brain outcome must persist evaluation signal");
assert.match(route, /new AgentHarness\(\{ maxSteps: 8, maxToolCalls: 8, maxWallTimeMs: 120_000/, "chat tools must run under the bounded harness");
assert.match(route, /harness: toolExecution\.harness/, "chat harness trace must be observable");
assert.match(route, /\?\.state === "verified"/, "research claim state must be propagated");
assert.match(autonomous, /claimByEvidenceId/, "autonomous learning must map evidence to adjudicated claims");
assert.match(autonomous, /publisher.*hostname/, "autonomous corroboration must use independent source identity");

assert.match(brain, /REQUIRE_AUTH = .*NEXORA_BRAIN_REQUIRE_AUTH/, "Brain auth requirement must be explicit");
assert.match(brain, /if REQUIRE_AUTH and not API_KEY:/, "Brain must fail closed when auth is required but missing");
assert.match(brain, /status.*degraded.*auth_configured/, "Brain health must expose missing auth without exposing secrets");

const { evaluateResearch } = await import("../src/lib/lia/research/evidence.ts");
const { assessPreAction } = await import("../src/lib/lia/pre-action-monitor.ts");
const result = evaluateResearch("test", [
  { id: "a", claim: "same claim", source: { tier: "official", url: "https://example.com/a", publisher: "Example" } },
  { id: "b", claim: "same claim", source: { tier: "official", url: "https://example.com/b", publisher: "Example" } },
]);
assert.equal(result.claims[0].state, "supported", "two URLs from the same publisher must not count as independent corroboration");

const result2 = evaluateResearch("test", [
  { id: "a", claim: "same claim", source: { tier: "official", url: "https://example.com/a", publisher: "Example A" } },
  { id: "b", claim: "same claim", source: { tier: "official", url: "https://example.org/b", publisher: "Example B" } },
]);
assert.equal(result2.claims[0].state, "verified", "independent strong sources should corroborate a claim");

assert.equal(assessPreAction({ tool: "get_cashflow", description: "Lire les flux", risk: "read", requiresUserApproval: false, deterministic: true }).disposition, "ALLOW");
assert.equal(assessPreAction({ tool: "create_recommendation", description: "Créer une proposition", risk: "recommendation", requiresUserApproval: true, deterministic: true }).disposition, "REQUIRE_APPROVAL");
assert.equal(assessPreAction({ tool: "unknown_write", description: "Modifier une donnée", risk: "write-sensitive", requiresUserApproval: true, deterministic: true }).disposition, "REQUIRE_APPROVAL");

console.log("PASS audit P0: truthful research/evaluation, bounded chat harness, Brain fail-closed, independent evidence gate");
