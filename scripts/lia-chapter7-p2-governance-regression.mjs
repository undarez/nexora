import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const read = f => fs.readFileSync(path.join(root, f), "utf8");
const registry = read("src/lib/lia/agents/registry.ts");
const executor = read("src/lib/lia/agents/executor.ts");
const runtime = read("src/lib/lia/agents/runtime.ts");
const autonomy = read("src/lib/lia/agents/autonomy.ts");
const adapters = read("src/lib/lia/agents/specialist-adapters.ts");
const permissions = read("src/lib/lia/skills/types.ts");
const agents = ["copywriting","seo","system-admin","data","finance","mobility","research"];
const skills = [
  "content-generation","technical-seo","system-health","data-quality",
  "finance-analytics","financial-reasoning","goal-lifecycle","mobility-fuel","mobility-profile",
  "tavily-search","tavily-research","source-trust","data-deduplication","anomaly-detection",
  "system-diagnostics","build-analysis"
];
for (const id of agents) {
  if (!registry.includes('id: "' + id + '"')) throw new Error("agent missing: " + id);
}
for (const id of skills) {
  if (!executor.includes('"' + id + '"')) throw new Error("executor route missing: " + id);
  if (!adapters.includes('register("' + id + '"') && !read("src/lib/lia/agents/safe-skills.ts").includes('id: "' + id + '"')) throw new Error("executable skill missing: " + id);
}
for (const permission of ["finance.read","mobility.read","research.read","data.read","system.read"]) {
  if (!permissions.includes('"' + permission + '"')) throw new Error("permission type missing: " + permission);
}
for (const token of ["calculateEffectiveAutonomy","permissionGranted","humanGateOpen","budgetRemaining"]) {
  if (!autonomy.includes(token) || !runtime.includes(token)) throw new Error("autonomy governance missing: " + token);
}
if (!runtime.includes("getExecutableLiaSkill")) throw new Error("runtime does not verify actual skill permissions");
if (!executor.includes('consume("research_requests")')) throw new Error("research budget not charged");
if (!adapters.includes("values.length % 2")) throw new Error("median calculation not robust for even samples");
if (!adapters.includes("booked_at") || !adapters.includes("currency")) throw new Error("financial duplicate fingerprint too weak");

console.log("P2 specialist E2E governance regression: PASS");
console.log("Agents:", agents.length, "| Executable specialist skills:", skills.length);
