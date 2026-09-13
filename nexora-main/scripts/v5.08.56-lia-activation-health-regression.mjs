import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const checks=[
 ['health module exists',fs.existsSync(path.join(root,'src/lib/lia/activation-health.ts'))],
 ['admin health route exists',fs.existsSync(path.join(root,'src/app/api/admin/lia/activation-health/route.ts'))],
 ['health computes failure rate',fs.readFileSync(path.join(root,'src/lib/lia/activation-health.ts'),'utf8').includes('failureRate')],
 ['critical threshold exists',fs.readFileSync(path.join(root,'src/lib/lia/activation-health.ts'),'utf8').includes('>= 0.4')],
 ['watch threshold exists',fs.readFileSync(path.join(root,'src/lib/lia/activation-health.ts'),'utf8').includes('>= 0.2')],
 ['automatic rollback blocked',fs.readFileSync(path.join(root,'src/lib/lia/activation-health.ts'),'utf8').includes('automaticRollback: false')],
 ['skill activation blocked',fs.readFileSync(path.join(root,'src/lib/lia/activation-health.ts'),'utf8').includes('skillActivation: false')],
 ['financial facts blocked',fs.readFileSync(path.join(root,'src/lib/lia/activation-health.ts'),'utf8').includes('financialFactUpdate: false')],
 ['admin route checks admin',fs.readFileSync(path.join(root,'src/app/api/admin/lia/activation-health/route.ts'),'utf8').includes('isAdmin')],
 ['30 day observation window',fs.readFileSync(path.join(root,'src/app/api/admin/lia/activation-health/route.ts'),'utf8').includes('30 * 24 * 60 * 60 * 1000')],
 ['active version is pinned',fs.readFileSync(path.join(root,'src/app/api/admin/lia/activation-health/route.ts'),'utf8').includes('active_version_id')],
 ['admin UI exposes health',fs.readFileSync(path.join(root,'src/app/(protected)/admin/lia-learning/ui.tsx'),'utf8').includes('santé des Skills')],
];
let failed=0;for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`);if(!ok)failed++;}if(failed)process.exit(1);console.log(`V5.08.56 Activation Health: ${checks.length}/${checks.length} PASS`);
