import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const requiredAdapters = [
  "finance-analytics","financial-reasoning","goal-lifecycle",
  "mobility-fuel","mobility-profile",
  "tavily-search","tavily-research","source-trust",
  "data-deduplication","anomaly-detection",
  "system-diagnostics","build-analysis",
];
const router = read("src/lib/lia/command/router.ts");
const adapters = read("src/lib/lia/agents/specialist-adapters.ts");
const executor = read("src/lib/lia/agents/executor.ts");
const safe = read("src/lib/lia/agents/safe-skills.ts");
const specialists = read("src/lib/lia/agents/specialists.ts");
const registry = read("src/lib/lia/agents/registry.ts");

for (const id of requiredAdapters) {
  if (!adapters.includes(`register("${id}"`)) throw new Error(`adapter missing: ${id}`);
  if (!executor.includes(`"${id}"`)) throw new Error(`executor not enabled: ${id}`);
}
if (!safe.includes("registerChapter7SpecialistAdapters()")) throw new Error("adapter registration not wired");
if (!specialists.includes("LIA_AGENT_DEFINITIONS.map")) throw new Error("specialist registry is not single-source");
if (registry.includes('autonomous: true')) throw new Error("absolute autonomous flag leaked into governance registry");
if (!router.includes("finance-analytics") || !router.includes("tavily-search") || !router.includes("mobility-fuel")) throw new Error("router coverage incomplete");
if (!adapters.includes('buildLiaFinancialProjection')) throw new Error("finance adapter not connected to financial gateway");
if (!adapters.includes('discoverTrustedSources')) throw new Error("research adapter not connected to governed search");
if (!adapters.includes('mutation: "none"')) throw new Error("data adapters must remain non-destructive");

console.log(`P1 specialist adapters regression: PASS (${requiredAdapters.length} adapters wired)`);
