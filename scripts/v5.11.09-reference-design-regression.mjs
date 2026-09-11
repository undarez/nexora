import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const checks = [
  ["reference design token layer", read("src/app/globals.css").includes("v5.11.09 — NEXORA Reference Design System")],
  ["violet/indigo brand tokens", read("src/app/globals.css").includes("--nexora-brand: #6750e8")],
  ["dark reference palette", read("src/app/globals.css").includes("--nexora-ref-bg: #0c1323")],
  ["desktop reference topbar", fs.existsSync(path.join(root, "src/components/app-topbar.tsx"))],
  ["topbar wired into protected shell", read("src/app/(protected)/layout.tsx").includes("<AppTopbar")],
  ["shared Card surface", read("src/components/ui/card.tsx").includes("nexora-card")],
  ["dashboard reference sections", ["nexora-networth-card","nexora-goals-card","nexora-kpi-grid","nexora-dashboard-grid-3","nexora-lia-bar"].every((x) => read("src/components/dashboard.tsx").includes(x))],
  ["real recent transactions", read("src/components/dashboard.tsx").includes('from("bank_transactions")') && read("src/components/dashboard.tsx").includes('from("transactions")')],
  ["Android shared reference theme", fs.existsSync(path.join(root, "android/app/src/main/java/com/nexora/finance/ui/theme/NexoraTheme.kt"))],
  ["Android theme wired", read("android/app/src/main/java/com/nexora/finance/MainActivity.kt").includes("NexoraTheme")],
  ["no generated image dependency", !read("src/components/app-topbar.tsx").includes(".png")],
];
let failed=0;
for (const [name, ok] of checks) { if (ok) console.log(`PASS ${name}`); else { console.error(`FAIL ${name}`); failed++; } }
console.log(`\n${checks.length-failed}/${checks.length} reference-design checks PASS`);
process.exitCode = failed ? 1 : 0;
