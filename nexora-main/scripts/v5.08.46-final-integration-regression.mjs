import fs from 'node:fs';
import path from 'node:path';

const read = (file) => fs.readFileSync(file, 'utf8');
const exists = (file) => fs.existsSync(file);
const checks = [];
const ok = (name, condition, detail='') => checks.push({name, condition:Boolean(condition), detail});

const copilot = read('src/lib/lia/financial-copilot.ts');
const executor = read('src/lib/agent-runtime/executor.ts');
const registry = read('src/lib/agent-runtime/tool-registry.ts');
const boundary = read('src/lib/lia/actions/boundary.ts');
const unified = read('src/lib/finance/unified-financial-context.ts');
const application = read('src/lib/lia/application-context.ts');
const governance = read('src/lib/lia/governance-audit.ts');
const auditMigration = read('supabase/migrations/0102_lia_governance_audit_integrity.sql');

ok('package version is current', /^0\.1\.(12[0-9]|1[3-9][0-9])$/.test(JSON.parse(read('package.json')).version));
ok('copilot uses personal financial model', copilot.includes('buildLiaPersonalFinancialModel'));
ok('copilot does not directly query transactions', !copilot.includes('from("transactions")') && !copilot.includes("from('transactions')"));
ok('copilot remains read-only', copilot.includes('humanApprovalRequired: true') && copilot.includes('recommendationIsNotAction: true'));
ok('unified financial context remains canonical projection', unified.includes('Single read-only cross-domain projection'));
ok('application context has source hierarchy', application.includes('authoritative') && application.includes('signal') && application.includes('context'));
ok('financial source outranks mail', application.includes('Une donnée financière confirmée prime sur un signal d\'email.'));
ok('action boundary blocks financial mutation', boundary.includes('mutatesFinancialState') && boundary.includes('Les écritures financières directes sont interdites'));
ok('create recommendation always human-gated', executor.includes('requires_human_approval:true') && !executor.includes('autonomous_executed'));
ok('tool registry declares approval', registry.includes('name: "create_recommendation"') && registry.includes('requiresUserApproval: true'));
ok('execute route rechecks boundary', exists('src/app/api/lia/actions/execute/route.ts') && read('src/app/api/lia/actions/execute/route.ts').includes('assertLiaActionCanBeExecuted'));
ok('governance audit sanitizes secrets', governance.includes('access_token') && governance.includes('refresh_token'));
ok('governance audit has hash-chain verification', auditMigration.includes('digest(payload,\'sha256\')') && auditMigration.includes('verify_lia_governance_audit'));
ok('admin open banking remains server-side', exists('src/app/admin/open-banking/page.tsx') || exists('src/app/(protected)/admin/open-banking/page.tsx'));
ok('enterprise access remains SIRET-gated', exists('src/lib/business/siret.ts'));
ok('90-day banking lifecycle remains present', exists('src/lib/banking/lifecycle.ts') && read('src/lib/banking/lifecycle.ts').includes('RECONNECT_WINDOW_DAYS = 90'));
ok('latest regression scripts present', exists('scripts/v5.08.58-lia-production-correlation-regression.mjs') && exists('scripts/v5.08.59-63-lia-agent-completion-regression.mjs'));

let pass=0;
for (const c of checks) console.log(`${c.condition?'PASS':'FAIL'} ${c.name}${c.detail?` — ${c.detail}`:''}`), pass += c.condition ? 1 : 0;
console.log(`V5.08.46: ${pass}/${checks.length} PASS`);
if (pass !== checks.length) process.exit(1);
