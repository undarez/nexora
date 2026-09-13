import fs from 'node:fs';
const read = (f) => fs.readFileSync(f, 'utf8');
const exists = (f) => fs.existsSync(f);
const checks = [];
const ok = (name, condition) => checks.push({ name, condition: Boolean(condition) });

const readiness = read('src/lib/lia/production-readiness.ts');
const route = read('src/app/api/admin/lia/readiness/route.ts');
const pkg = JSON.parse(read('package.json'));

ok('package version is current', /^0\.1\.(12[0-9]|1[3-9][0-9])$/.test(pkg.version));
ok('readiness module exists', exists('src/lib/lia/production-readiness.ts'));
ok('readiness is server-side', readiness.includes('process.env'));
ok('no secret values returned', !readiness.includes('process.env[name]') || readiness.includes('Boolean(process.env[name]?.trim())'));
ok('required Supabase gates', readiness.includes('NEXT_PUBLIC_SUPABASE_URL') && readiness.includes('SUPABASE_SERVICE_ROLE_KEY'));
ok('admin control-plane gate', readiness.includes('ADMIN_EMAILS'));
ok('optional integrations are warnings', readiness.includes("['POWENS_CLIENT_ID', 'POWENS_API_KEY'], false") && readiness.includes("['RESEND_API_KEY'], false"));
ok('aggregate readiness level', readiness.includes("checks.some((c) => c.level === 'blocked')") && readiness.includes("checks.some((c) => c.level === 'warning')"));
ok('admin route exists', exists('src/app/api/admin/lia/readiness/route.ts'));
ok('admin route requires admin', route.includes('requireAdmin(supabase)'));
ok('no-store response', route.includes("'Cache-Control': 'no-store'"));
ok('regression registered', pkg.scripts['lia:production-readiness'] === 'node scripts/v5.08.47-lia-production-readiness-regression.mjs');

let pass=0;
for (const c of checks) { console.log(`${c.condition ? 'PASS' : 'FAIL'} ${c.name}`); if(c.condition) pass++; }
console.log(`V5.08.47: ${pass}/${checks.length} PASS`);
if (pass !== checks.length) process.exit(1);
