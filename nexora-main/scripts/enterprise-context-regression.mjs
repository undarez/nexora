import fs from "node:fs";
const read = (p) => fs.readFileSync(p, "utf8");
const context = read("src/lib/enterprise/dashboard-context.ts");
const page = read("src/app/(protected)/entreprise/page.tsx");
for (const [name, ok] of [
  ["single enterprise dashboard context", context.includes("buildUnifiedFinancialContext")],
  ["bank + manual ledgers reuse", context.includes('from(\"bank_transactions\")') && context.includes('from(\"transactions\")')],
  ["budget reused", context.includes("financial.budget")],
  ["six month activity history", context.includes("history") && context.includes("setMonth")],
  ["page consumes new dashboard context", page.includes("buildEnterpriseDashboardContext")],
  ["no legacy enterprise context file", !fs.existsSync("src/lib/enterprise/financial-context.ts")],
  ["no legacy enterprise obligations API", !fs.existsSync("src/app/api/enterprise/obligations/route.ts")],
]) { if (!ok) { console.error(`FAIL ${name}`); process.exitCode = 1; } else console.log(`OK ${name}`); }
if (!process.exitCode) console.log("Enterprise context regression: PASS");
