import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const checks = [
  ["90-day migration", fs.existsSync(path.join(root, "supabase/migrations/0092_open_banking_90_day_reconnection.sql"))],
  ["reconnect_due_at schema", read("supabase/migrations/0092_open_banking_90_day_reconnection.sql").includes("reconnect_due_at timestamptz")],
  ["90-day sync gate", read("src/lib/banking/lifecycle.ts").includes("RECONNECT_90D_REQUIRED")],
  ["callback schedules +90 days", read("src/app/api/banking/powens/callback/route.ts").includes("90 * 24 * 60 * 60 * 1000")],
  ["bank page shows reconnect deadline", read("src/app/(protected)/banque/page.tsx").includes("reconnect_due_at")],
  ["notification milestones", read("supabase/migrations/0092_open_banking_90_day_reconnection.sql").includes("bank-reconnect:")],
];
let failed = 0;
for (const [label, ok] of checks) { console.log(`${ok ? "OK" : "FAIL"} ${label}`); if (!ok) failed++; }
process.exitCode = failed ? 1 : 0;
