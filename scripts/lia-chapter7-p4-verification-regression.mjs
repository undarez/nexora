import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const route = fs.readFileSync(path.join(root, "src/app/api/lia/runtime/p4-verify/route.ts"), "utf8");
const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));

const checks = [
  ["verification route exists", route.includes("continuous_operations.verification")],
  ["verification is cron-secret protected", route.includes("LIA_CRON_SECRET") && route.includes("CRON_SECRET")],
  ["verification correlates wake to cron run", route.includes("last_run_at") && route.includes("wake_belongs_to_cron") && route.includes("30 * 60 * 1000")],
  ["verification requires a completed wake trace", route.includes("wake_confirmed") && route.includes("wake_completed") && route.includes('latestWake?.status === "completed"') && route.includes("lia_autonomous_wakes")],
  ["verification cannot authorize financial writes", route.includes("lia_runtime_events") && !route.includes("financial_writes_allowed: true")],
  ["verification cron is scheduled", vercel.crons?.some((cron) => cron.path === "/api/lia/runtime/p4-verify" && cron.schedule === "0 21 * * *")],
];

let ok = 0;
for (const [name, pass] of checks) {
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
  if (pass) ok++;
}
if (ok !== checks.length) process.exit(1);
console.log(`P4 verification regression: ${ok}/${checks.length} PASS`);
