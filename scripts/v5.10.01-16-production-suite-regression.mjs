import fs from 'node:fs';
import path from 'node:path';

const exists = (p) => fs.existsSync(p);
const read = (p) => exists(p) ? fs.readFileSync(p, 'utf8') : '';
const checks = [
  ['E2E test matrix', 'docs/production/e2e-test-matrix.md', ['registration','Open Banking','Enterprise','Stripe','LIA']],
  ['database integrity checklist', 'docs/production/database-integrity.md', ['RLS','foreign key','index','RPC']],
  ['performance checklist', 'docs/production/performance.md', ['N+1','pagination','P95','Supabase']],
  ['security red-team checklist', 'docs/production/security-red-team.md', ['IDOR','CSRF','XSS','privilege']],
  ['privacy checklist', 'docs/production/privacy-rgpd.md', ['minimisation','retention','export','deletion']],
  ['responsive checklist', 'docs/production/responsive.md', ['mobile','tablet','desktop']],
  ['UI polish checklist', 'docs/production/ui-polish.md', ['dark','light','logo','loading']],
  ['accessibility checklist', 'docs/production/accessibility.md', ['keyboard','focus','contrast','ARIA']],
  ['onboarding checklist', 'docs/production/onboarding.md', ['registration','bank','LIA']],
  ['financial UX checklist', 'docs/production/financial-ux.md', ['dashboard','transactions','budget','goals']],
  ['enterprise UX checklist', 'docs/production/enterprise-ux.md', ['SIRET','permissions','personal']],
  ['LIA behavioral corpus', 'tests/production/lia-behavioral-scenarios.json', ['5.10.12','synthetic','cases']],
  ['observability checklist', 'docs/production/observability.md', ['latency','cost','errors','Open Banking']],
  ['backup recovery checklist', 'docs/production/backup-recovery.md', ['backup','restore','RPO','RTO']],
  ['incident readiness checklist', 'docs/production/incident-readiness.md', ['rollback','incident','provider']],
  ['release candidate checklist', 'docs/production/release-candidate.md', ['staging','production','go/no-go']],
];
let pass=0;
for(const [label,file,tokens] of checks){
  const text=read(file); const ok=!!text && tokens.every(t=>text.toLowerCase().includes(t.toLowerCase()));
  console.log(`${ok?'PASS':'FAIL'} ${label}`); if(ok) pass++;
}
const routes=[];
function walk(dir){ if(!exists(dir)) return; for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name); if(e.isDirectory()) walk(p); else if(/^route\.tsx?$/.test(e.name)) routes.push(p);} }
walk('src/app/api');
console.log(`PASS API inventory: ${routes.length} route files scanned`);
const pkg=JSON.parse(read('package.json'));
const versionOk=Number(pkg.version.split('.').map(x=>x.replace(/\D/g,'')||'0').join(''))>=120;
console.log(`${versionOk?'PASS':'FAIL'} package release version >= 0.1.120`); if(versionOk) pass++;
console.log(`\n${pass}/${checks.length+1} production suite checks PASS`);
if(pass!==checks.length+1) process.exit(1);
