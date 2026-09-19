import fs from "node:fs";

const page = fs.readFileSync("src/app/(protected)/orchestration/page.tsx", "utf8");
const route = fs.readFileSync("src/app/api/lia/orchestrate/route.ts", "utf8");
const orchestrator = fs.readFileSync("src/lib/lia/orchestrator.ts", "utf8");
const runtime = fs.readFileSync("src/lib/lia/orchestrator-runtime.ts", "utf8");
const checks = [
  ["client sends objective", page.includes("JSON.stringify({ objective: goal })")],
  ["route validates objective", route.includes('typeof body.objective !== "string"')],
  ["orchestrator searches use cases", orchestrator.includes("searchLiaUseCases(")],
  ["orchestrator searches skills", orchestrator.includes("searchLiaSkills(")],
  ["route returns governance", route.includes("governance: plan.governance")],
  ["runtime respects persisted plan budget", runtime.includes("persistedMaxSteps")],
  ["runtime avoids phantom trace steps", runtime.includes("if (result.step)")],
  ["UI displays execution output", page.includes("JSON.stringify(item.output, null, 2)")],
  ["UI reflects runtime step status", page.includes("executionByStep.get(step.index)?.status")],
];
for (const [label, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
if (checks.some(([, ok]) => !ok)) process.exit(1);
console.log("Orchestration contract regression OK");
