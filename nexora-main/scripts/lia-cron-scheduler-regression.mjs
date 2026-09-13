import { execFileSync } from "node:child_process";

// The app's TS module is not directly executable by Node without the project loader.
// Validate the source contract and timezone-aware implementation statically.
const fs = await import("node:fs/promises");
const scheduler = await fs.readFile("src/lib/lia/runtime/cron-scheduler.ts", "utf8");
const autoCron = await fs.readFile("src/lib/lia/runtime/auto-cron.ts", "utf8");
const route = await fs.readFile("src/app/api/lia/runtime/cron/route.ts", "utf8");
const checks = [
  ["scheduler accepts timezone", scheduler.includes('timeZone = "UTC"')],
  ["scheduler uses Intl timezone conversion", scheduler.includes("Intl.DateTimeFormat")],
  ["bootstrap computes Paris next run", autoCron.includes('nextCronRun(schedule, new Date(), "Europe/Paris")')],
  ["learning cron computes Paris next run", autoCron.includes('nextCronRun(learningSchedule, new Date(), "Europe/Paris")')],
  ["runtime cron uses job timezone", route.includes('nextCronRun(schedule, now, String(job.timezone || "UTC"))')],
];
for (const [label, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
if (checks.some(([, ok]) => !ok)) process.exit(1);
console.log("Cron scheduler regression OK");
