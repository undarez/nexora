import fs from "node:fs";

const page = fs.readFileSync("src/app/(protected)/orchestration/page.tsx", "utf8");
const route = fs.readFileSync("src/app/api/lia/orchestrate/route.ts", "utf8");
const orchestrator = fs.readFileSync("src/lib/lia/orchestrator.ts", "utf8");
const checks = [
  ["client sends objective", page.includes("JSON.stringify({ objective: goal })")],
  ["route validates objective", route.includes('typeof body.objective !== "string"')],
  ["orchestrator searches use cases", orchestrator.includes("searchLiaUseCases(")],
  ["orchestrator searches skills", orchestrator.includes("searchLiaSkills(")],
  ["route returns governance", route.includes("governance: plan.governance")],
];
for (const [label, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
if (checks.some(([, ok]) => !ok)) process.exit(1);
console.log("Orchestration contract regression OK");
