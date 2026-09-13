import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const checks = [];
const assert = (name, ok) => { checks.push([name, Boolean(ok)]); if (!ok) throw new Error(`FAIL: ${name}`); };

const ctx = read("src/lib/finance/unified-financial-context.ts");
const dash = read("src/components/dashboard.tsx");
const forecast = read("src/app/(protected)/previsions/page.tsx");
const pilot = read("src/app/(protected)/pilotage/page.tsx");
const summary = read("src/components/finance/financial-cross-domain-summary.tsx");

assert("unified context is version 4", ctx.includes("version: 4"));
assert("unified context includes primary liquidity", ctx.includes("primary_total"));
assert("unified context includes budget projection", ctx.includes("projected_end"));
assert("projection subtracts planned spend", ctx.includes("- planned - extraExpense"));
assert("dashboard consumes unified context", dash.includes("/api/finance/unified-context"));
assert("forecast consumes unified context", forecast.includes("/api/finance/unified-context"));
assert("pilotage consumes unified context", pilot.includes("/api/finance/unified-context"));
assert("summary can reuse already-loaded context", summary.includes("context?: Context | null"));
assert("dashboard does not query transaction ledger directly", !dash.includes('from("transactions")'));
assert("dashboard does not query account ledger directly", !dash.includes('from("accounts")'));
assert("pilotage uses bank + manual unified KPIs", pilot.includes("context.cashflow") && pilot.includes("context.liquidity"));
assert("pilotage recurrence sees bank transactions", pilot.includes('from(\"bank_transactions\")'));
assert("unified context derives transaction intelligence", ctx.includes("deriveTransactionIntelligence"));
assert("summary exposes intelligence", summary.includes("intelligence.recurring") && summary.includes("intelligence.anomalies"));

console.log(checks.map(([name]) => `OK ${name}`).join("\n"));
