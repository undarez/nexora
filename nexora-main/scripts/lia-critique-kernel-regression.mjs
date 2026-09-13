import fs from "node:fs";
import path from "node:path";
const file = path.resolve("src/lib/lia/critique-kernel.ts");
const source = fs.readFileSync(file, "utf8");
for (const token of ["export function critiqueNexoraPlan", "MISSING_EVIDENCE_STEP", "RESEARCH_NOT_VERIFIED", "HUMAN_GATE_MISSING", "critique_never_authorizes_financial_write"]) {
  if (!source.includes(token)) throw new Error(`Critique Kernel regression failed: ${token}`);
}
const route = fs.readFileSync(path.resolve("src/app/api/lia/chat/route.ts"), "utf8");
for (const token of ["critiqueNexoraPlan", "lia:critique-kernel", "critiquePrompt"]) {
  if (!route.includes(token)) throw new Error(`Critique integration regression failed: ${token}`);
}
console.log("✓ NEXORA Critique Kernel regression passed");
