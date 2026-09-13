import fs from "node:fs";
import path from "node:path";

const file = path.resolve("src/lib/lia/decision-kernel.ts");
const source = fs.readFileSync(file, "utf8");
for (const token of [
  "export function runNexoraDecisionKernel",
  '"proceed"',
  '"human_validation_required"',
  '"replan_required"',
  "decision_kernel_never_authorizes_financial_write",
  "policy_engine_remains_authoritative",
  "decision_gate_remains_authoritative",
  "financialWriteAuthorized: false",
]) {
  if (!source.includes(token)) throw new Error(`Decision Kernel regression failed: ${token}`);
}
const route = fs.readFileSync(path.resolve("src/app/api/lia/chat/route.ts"), "utf8");
for (const token of ["runNexoraDecisionKernel", "lia:decision-kernel", "decisionKernelPrompt", "nexoraDecision"]) {
  if (!route.includes(token)) throw new Error(`Decision Kernel integration regression failed: ${token}`);
}
console.log("✓ NEXORA Decision Kernel regression passed");
