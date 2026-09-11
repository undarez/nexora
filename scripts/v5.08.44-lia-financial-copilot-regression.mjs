import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const checks = [
  ["copilot module exists", fs.existsSync(path.join(root,"src/lib/lia/financial-copilot.ts"))],
  ["copilot API exists", fs.existsSync(path.join(root,"src/app/api/lia/copilot/route.ts"))],
  ["copilot has read-only governance", fs.readFileSync(path.join(root,"src/lib/lia/financial-copilot.ts"),"utf8").includes("readOnlyContext: true")],
  ["recommendation remains human gated", fs.readFileSync(path.join(root,"src/lib/lia/financial-copilot.ts"),"utf8").includes("humanApprovalRequired: true")],
  ["recommendation engine reused", fs.readFileSync(path.join(root,"src/lib/lia/financial-copilot.ts"),"utf8").includes("buildLiaRecommendation")],
  ["application context helper has no leaked mail query variable", !fs.readFileSync(path.join(root,"src/lib/lia/application-context.ts"),"utf8").split("export async function buildLiaApplicationContext")[0].includes("mailConnectionsResult.data")],
];
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
if (checks.some(([,ok])=>!ok)) process.exit(1);
console.log(`${checks.length}/${checks.length} PASS`);
