import fs from "node:fs";
import path from "node:path";

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const checks = [];
const assert = (name, ok) => checks.push([name, Boolean(ok)]);

const sidebar = read("src/components/desktop-sidebar.tsx");
const pilotage = read("src/app/(protected)/pilotage/page.tsx");
const autopilot = read("src/app/(protected)/autopilot/page.tsx");
const habits = read("src/app/(protected)/habitudes/page.tsx");
const cron = read("src/app/api/lia/runtime/cron/route.ts");
const summary = read("src/components/finance/financial-cross-domain-summary.tsx");

assert("autopilot is merged into pilotage", autopilot.includes('/pilotage#autopilot'));
assert("habits are merged into pilotage", habits.includes('/pilotage#habitudes'));
assert("sidebar no longer duplicates autopilot", !sidebar.includes('["/autopilot"'));
assert("sidebar no longer duplicates habits", !sidebar.includes('["/habitudes"'));
assert("pilotage owns autopilot content", pilotage.includes("Autopilote financier intégré"));
assert("pilotage owns habits content", pilotage.includes("Habitudes financières intégrées"));
assert("proactive notifications point to pilotage", cron.includes('/pilotage#autopilot'));
assert("cross-domain summary is reusable", summary.includes("UnifiedFinancialContext"));

for (const [name, ok] of checks) console.log(`${ok ? "OK" : "FAIL"} ${name}`);
if (checks.some(([, ok]) => !ok)) process.exit(1);
