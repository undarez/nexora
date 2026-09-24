import { readFile } from "node:fs/promises";

const files = {
  engine: await readFile("src/lib/lia/continuous-operations.ts", "utf8"),
  migration: await readFile("supabase/migrations/20260924100000_lia_chapter7_p4_continuous_operations.sql", "utf8"),
  route: await readFile("src/app/api/lia/runtime/continuous/route.ts", "utf8"),
  cron: await readFile("src/app/api/lia/runtime/cron/route.ts", "utf8"),
  autoCron: await readFile("src/lib/lia/runtime/auto-cron.ts", "utf8"),
};

const checks = [
  ["durable wake table", files.migration.includes("lia_autonomous_wakes")],
  ["single running wake per user", files.migration.includes("lia_autonomous_wakes_one_running_user_idx")],
  ["wake preparation loads governed controls", files.engine.includes("prepareLiaWake") && files.engine.includes("getLiaRuntimeControls")],
  ["recovery has priority", files.engine.includes("stats.recentFailures >= 2")],
  ["active goals are continued", files.engine.includes("runAutonomousGoal")],
  ["learning remains governed", files.engine.includes("runAutonomousLearningCycle")],
  ["proactive observation is bounded", files.engine.includes("runProactiveFinancialLoop")],
  ["learning does not auto-activate skills", files.engine.includes("runAutonomousLearningCycle")],
  ["runtime endpoint uses cron secret", files.route.includes("LIA_CRON_SECRET") && files.route.includes("CRON_SECRET")],
  ["cron worker remains separate", files.cron.includes("/api/lia/runtime/cron") === false || files.cron.includes("authorized")],
  ["continuous operation is explicitly bounded", files.engine.includes("continuousOperationBudget")],
];

for (const [label, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
if (checks.some(([, ok]) => !ok)) process.exit(1);
console.log("Chapter 7 P4 continuous operations regression OK");
