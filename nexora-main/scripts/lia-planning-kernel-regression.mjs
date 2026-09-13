import fs from "node:fs";
import path from "node:path";

const file = path.resolve("src/lib/lia/planning-kernel.ts");
const source = fs.readFileSync(file, "utf8");
for (const token of [
  "export function buildNexoraPlan",
  "planning_never_authorizes_financial_write",
  "policy_engine_remains_authoritative",
  '"human_gate"',
  "maxReplans",
  "nextPlannedStep",
]) {
  if (!source.includes(token)) throw new Error(`Planning Kernel regression failed: ${token}`);
}
const route = fs.readFileSync(path.resolve("src/app/api/lia/chat/route.ts"), "utf8");
for (const token of ["buildNexoraPlan", "lia:planning-kernel", "planningPrompt", "planning,"]) {
  if (!route.includes(token)) throw new Error(`Planning integration regression failed: ${token}`);
}
console.log("✓ NEXORA Decision & Planning Kernel regression passed");
