import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const checks = [
  ["new enterprise page exists", fs.existsSync(path.join(root, "src/app/(protected)/entreprise/page.tsx"))],
  ["new enterprise dashboard exists", fs.existsSync(path.join(root, "src/components/enterprise/enterprise-dashboard.tsx"))],
  ["new enterprise context exists", fs.existsSync(path.join(root, "src/lib/enterprise/dashboard-context.ts"))],
  ["legacy enterprise financial context removed", !fs.existsSync(path.join(root, "src/lib/enterprise/financial-context.ts"))],
  ["legacy enterprise obligations API removed", !fs.existsSync(path.join(root, "src/app/api/enterprise/obligations/route.ts"))],
  ["dashboard uses unified financial context", fs.readFileSync(path.join(root, "src/lib/enterprise/dashboard-context.ts"), "utf8").includes("buildUnifiedFinancialContext")],
  ["dashboard does not depend on business obligations", !fs.readFileSync(path.join(root, "src/lib/enterprise/dashboard-context.ts"), "utf8").includes("business_financial_obligations")],
  ["dashboard states accounting limits honestly", fs.readFileSync(path.join(root, "src/components/enterprise/enterprise-dashboard.tsx"), "utf8").includes("Comptabilité")],
  ["enterprise page enforces verified SIRET", fs.readFileSync(path.join(root, "src/app/(protected)/entreprise/page.tsx"), "utf8").includes("hasVerifiedSiret") && fs.readFileSync(path.join(root, "src/app/(protected)/entreprise/page.tsx"), "utf8").includes("/onboarding?type=business&reason=siret_required")],
  ["enterprise onboarding validates SIRET", fs.readFileSync(path.join(root, "src/app/api/workspaces/onboard/route.ts"), "utf8").includes("isValidSiret(siret)") && fs.readFileSync(path.join(root, "src/app/api/workspaces/onboard/route.ts"), "utf8").includes("verifySiret(siret)")],
  ["dashboard fixed commitments have collision-safe keys", fs.readFileSync(path.join(root, "src/components/dashboard.tsx"), "utf8").includes('fixed.slice(0,7).map((e,i)=>') && fs.readFileSync(path.join(root, "src/components/dashboard.tsx"), "utf8").includes('e.id || e.label || "fixed"')],
];
let failed = 0;
for (const [label, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${label}`); if (!ok) failed += 1; }
console.log(`${checks.length - failed}/${checks.length} checks passed`);
if (failed) process.exit(1);
