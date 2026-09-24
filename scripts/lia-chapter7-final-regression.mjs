import assert from "node:assert/strict";
import fs from "node:fs";

const registry = fs.readFileSync("src/lib/lia/agents/registry.ts", "utf8");
const safeSkills = fs.readFileSync("src/lib/lia/agents/safe-skills.ts", "utf8");
const executor = fs.readFileSync("src/lib/lia/agents/executor.ts", "utf8");
const adapters = fs.readFileSync("src/lib/lia/agents/specialist-adapters.ts", "utf8");
const router = fs.readFileSync("src/lib/lia/command/router.ts", "utf8");

const expectedAgents = [
  "copywriting",
  "seo",
  "system-admin",
  "data",
  "finance",
  "mobility",
  "research",
];

const expectedSkills = [
  "content-generation",
  "ux-copy",
  "email-copy",
  "technical-seo",
  "keyword-analysis",
  "metadata",
  "system-health",
  "system-diagnostics",
  "build-analysis",
  "data-quality",
  "data-deduplication",
  "anomaly-detection",
  "finance-analytics",
  "financial-reasoning",
  "goal-lifecycle",
  "transaction-intelligence",
  "budget-management",
  "mobility-fuel",
  "mobility-profile",
  "tavily-search",
  "tavily-research",
  "source-trust",
];

for (const agent of expectedAgents) assert.ok(registry.includes(`id: "${agent}"`) || registry.includes(`id:"${agent}"`), `agent missing: ${agent}`);
for (const skill of expectedSkills) {
  assert.ok(
    safeSkills.includes(`"${skill}"`) || adapters.includes(`"${skill}"`) || executor.includes(`"${skill}"`),
    `skill not executable: ${skill}`,
  );
}

const routedInputs = [
  ["copywriting.generate", "copywriting", "content-generation"],
  ["seo.audit", "seo", "technical-seo"],
  ["system.health_check", "system-admin", "system-health"],
  ["data.quality_check", "data", "data-quality"],
  ["finance.spending.analyze", "finance", "financial-reasoning"],
  ["finance.transactions.read", "finance", "transaction-intelligence"],
  ["mobility.trip.cost", "mobility", "mobility-fuel"],
  ["research.search", "research", "tavily-search"],
];

for (const [intent, agentId, skillId] of routedInputs) {
  assert.ok(router.includes(`"${intent}":`), `route missing: ${intent}`);
  assert.ok(router.includes(`agent:"${agentId}"`), `agent route missing: ${agentId}`);
  assert.ok(router.includes(`skill:"${skillId}"`), `skill route missing: ${skillId}`);
}

assert.ok(router.includes('"finance.budget.allocate":{agent:"finance",skill:"budget-management"'));
assert.ok(router.includes('"productivity.task.create"'));
assert.ok(!registry.includes('id: "productivity"'));

console.log(`LIA Chapter 7 final loop regression: PASS (${expectedSkills.length} governed skills checked)`);
