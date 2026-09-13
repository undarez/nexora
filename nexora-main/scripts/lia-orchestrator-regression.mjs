import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const files = [
  "src/lib/lia/orchestrator.ts",
  "src/app/api/lia/orchestrate/route.ts",
  "supabase/migrations/0063_lia_orchestrator.sql",
];
for (const file of files) {
  if (!fs.existsSync(path.join(root,file))) throw new Error(`missing ${file}`);
}
const source = fs.readFileSync(path.join(root,"src/lib/lia/orchestrator.ts"),"utf8");
for (const token of ["buildLiaOrchestrationPlan","persistLiaOrchestrationPlan","human_gate_sensitive_action","planning_only"]) {
  if (!source.includes(token)) throw new Error(`missing contract token: ${token}`);
}
console.log("✓ bounded orchestrator contract");
