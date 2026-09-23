import assert from "node:assert/strict";
import { buildLiaCommandPlan } from "../src/lib/lia/command/index.ts";
import { LIA_AGENT_DEFINITIONS } from "../src/lib/lia/agents/registry.ts";
import { registerChapter7SafeSkills } from "../src/lib/lia/agents/safe-skills.ts";
import { getExecutableLiaSkill, listExecutableLiaSkills } from "../src/lib/lia/agent/skill-runtime.ts";

registerChapter7SafeSkills();

const executable = new Set(listExecutableLiaSkills().map(skill => skill.id));
for (const agent of LIA_AGENT_DEFINITIONS) {
  for (const skill of agent.skills) assert.ok(executable.has(skill), `skill non executable: ${agent.id}/${skill}`);
}

const routedInputs = [
  ["Rédige une description pour la landing page", "copywriting", "content-generation"],
  ["Fais un audit SEO de la landing page", "seo", "technical-seo"],
  ["Vérifie si le système Nexora fonctionne correctement", "system-admin", "system-health"],
  ["Vérifie la qualité de mes données", "data", "data-quality"],
  ["Analyse mes dépenses récurrentes", "finance", "financial-reasoning"],
  ["Montre-moi les récurrences de mes transactions", "finance", "transaction-intelligence"],
  ["Calcule le coût de mon trajet de 100 km", "mobility", "mobility-fuel"],
  ["Recherche des informations sur le budget familial", "research", "tavily-search"],
];

for (const [input, agentId, skillId] of routedInputs) {
  const plan = buildLiaCommandPlan(input);
  assert.equal(plan.route.agent, agentId, input);
  assert.equal(plan.route.skill, skillId, input);
  assert.ok(getExecutableLiaSkill(skillId), `route executable missing: ${skillId}`);
}

const writePlan = buildLiaCommandPlan("Alloue 100 euros au budget courses");
assert.equal(writePlan.route.agent, "finance");
assert.equal(writePlan.route.skill, "budget-management");
assert.equal(writePlan.policy.requiresConfirmation, true);

console.log(`LIA Chapter 7 final loop regression: PASS (${executable.size} executable skills)`);
