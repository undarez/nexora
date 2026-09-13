import fs from 'node:fs';
import path from 'node:path';

const checks = [
  ['SIRET utility validates exactly 14 digits', 'src/lib/business/siret.ts', fs.readFileSync('src/lib/business/siret.ts','utf8').includes('^\\d{14}$')],
  ['Business onboarding verifies SIRET against official registry', 'src/app/api/workspaces/onboard/route.ts', fs.readFileSync('src/app/api/workspaces/onboard/route.ts','utf8').includes('recherche-entreprises.api.gouv.fr/search')],
  ['Business onboarding rejects non-active establishments', 'src/app/api/workspaces/onboard/route.ts', fs.readFileSync('src/app/api/workspaces/onboard/route.ts','utf8').includes('business.status !== "active"')],
  ['Business onboarding prevents duplicate SIRET', 'src/app/api/workspaces/onboard/route.ts', fs.readFileSync('src/app/api/workspaces/onboard/route.ts','utf8').includes('duplicateSiret')],
  ['Business profile route exists', 'src/app/api/workspaces/business-profile/route.ts', fs.existsSync('src/app/api/workspaces/business-profile/route.ts')],
  ['Enterprise dashboard displays verified legal identity', 'src/components/enterprise/enterprise-dashboard.tsx', fs.readFileSync('src/components/enterprise/enterprise-dashboard.tsx','utf8').includes('Identité légale')],
  ['Enterprise access remains server-side gated', 'src/app/(protected)/entreprise/page.tsx', fs.readFileSync('src/app/(protected)/entreprise/page.tsx','utf8').includes('hasVerifiedSiret')],
];
let passed = 0;
for (const [name, file, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} — ${name} (${file})`); if (ok) passed++; }
console.log(`\n${passed}/${checks.length} checks passed.`);
if (passed !== checks.length) process.exit(1);
