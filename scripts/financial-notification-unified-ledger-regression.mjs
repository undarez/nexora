import { readFile } from "node:fs/promises";

const migration = await readFile(
  "supabase/migrations/20260927100000_financial_notifications_unified_ledger.sql",
  "utf8",
);

const checks = [
  ["notification refresh remains owner-scoped", migration.includes("uid <> p_user_id")],
  ["active bank balances are included", migration.includes("public.bank_accounts") && migration.includes("ba.status = 'active'")],
  ["bank transactions are included in monthly cashflow", migration.includes("public.bank_transactions")],
  ["manual and bank ledgers are both queried", migration.includes("public.transactions") && migration.includes("union all")],
  ["90-day bank reminders remain present", migration.includes("reconnect_due_at") && migration.includes("bank_reconnect")],
  ["saving opportunity uses unified liquidity", migration.includes("balance > safety")],
];

for (const [label, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
if (checks.some(([, ok]) => !ok)) process.exit(1);
console.log("Financial notification unified-ledger regression: PASS");
