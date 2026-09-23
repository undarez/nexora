import assert from "node:assert/strict";
import { buildLiaCommandPlan } from "../src/lib/lia/command/index.ts";
import { LIA_AGENT_DEFINITIONS, getLiaAgentDefinition } from "../src/lib/lia/agents/registry.ts";
import { executeSpecialistCommand } from "../src/lib/lia/agents/executor.ts";
import { planSpecialistExecution } from "../src/lib/lia/agents/runtime.ts";

const required = ["copywriting", "seo", "system-admin", "data"];
for (const id of required) {
  const agent = getLiaAgentDefinition(id);
  assert.ok(agent, "agent missing: " + id);
  assert.ok(agent.skills.length > 0, id + " has no skills");
  assert.ok(agent.permissions.length > 0, id + " has no permissions");
  assert.equal(agent.verifyRequired, true, id + " must require verification");
}
assert.ok(LIA_AGENT_DEFINITIONS.length >= 7);

const cases = [
  ["Rédige une description pour la landing page", "copywriting", "content-generation"],
  ["Fais un audit SEO de la landing page", "seo", "technical-seo"],
  ["Vérifie si le système Nexora fonctionne correctement", "system-admin", "system-health"],
  ["Vérifie la qualité de mes données", "data", "data-quality"],
  ["Supprime les doublons de transactions", "data", "data-deduplication"],
];

for (const [input, agentId, skillId] of cases) {
  const plan = buildLiaCommandPlan(input);
  const execution = planSpecialistExecution(plan);
  assert.equal(execution.agent.id, agentId, input);
  assert.equal(execution.steps[0].skillId, skillId, input);
  if (plan.policy.requiresConfirmation) assert.equal(execution.status, "waiting_confirmation");
}

const draft = await executeSpecialistCommand("Rédige un texte pour la landing page", { userId: "test-user", permissions: [] });
assert.equal(draft.status, "completed");
assert.equal(draft.verification.passed, true);

const health = await executeSpecialistCommand("Vérifie si le système Nexora fonctionne correctement", { userId: "test-user", permissions: [] });
assert.equal(health.status, "completed");
assert.equal(health.verification.passed, true);
assert.equal(health.output.result.runtime.startsWith("v"), true);

const seo = await executeSpecialistCommand("Fais un audit SEO de <h1>Nexora</h1>", { userId: "test-user", permissions: [] });
assert.equal(seo.status, "completed");
assert.equal(seo.verification.passed, true);
assert.equal(seo.output.result.checks.h1, true);

const data = await executeSpecialistCommand("Vérifie la qualité de mes données", { userId: "test-user", permissions: [] });
assert.equal(data.status, "completed");
assert.equal(data.verification.passed, true);
assert.equal(data.output.result.mutation, "none");

const destructive = await executeSpecialistCommand("Supprime les doublons de transactions", { userId: "test-user", permissions: [] });
assert.equal(destructive.status, "waiting_confirmation");

console.log("LIA Chapter 7 specialist agents regression: PASS");
