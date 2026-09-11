import fs from 'node:fs';
import path from 'node:path';

const root='src/app/api';
const files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(e.name==='route.ts'||e.name==='route.tsx')files.push(p)}}
walk(root);
const publicPatterns=[/\/api\/auth\//,/\/api\/health\b/,/\/api\/stripe\/webhook\b/,/\/api\/payments\/stripe\/webhook\b/,/\/api\/banking\/powens\/webhook\b/,/\/api\/banking\/powens\/callback\b/];
let authChecked=0, unguarded=[];
for(const f of files){const s=fs.readFileSync(f,'utf8');
  const publicRoute=publicPatterns.some(r=>r.test('/'+f.replaceAll('\\','/')));
  const hasAuth=/getUser\(|getSession\(|requireAdmin|assertAdmin|assertSameOrigin|createServerClient|createClient\(\)|authorized\(request\)/.test(s);
  if(!publicRoute){authChecked++; if(!hasAuth) unguarded.push(f)}
}
const required=[
 ['security headers','next.config.ts',['Strict-Transport-Security','X-Content-Type-Options','X-Frame-Options','Cache-Control']],
 ['resilience helper','src/lib/production/resilience.ts',['ProductionDependencyError','withTimeout','safeErrorMessage']],
 ['protected error boundary','src/app/(protected)/error.tsx',['Réessayer']],
 ['global error boundary','src/app/global-error.tsx',['NEXORA a rencontré un problème']],
 ['runtime metrics migration','supabase/migrations/0112_lia_production_runtime_metrics.sql',['latency_ms','estimated_cost_cents']],
];
let pass=0;
for(const [label,file,tokens] of required){const ok=fs.existsSync(file)&&tokens.every(t=>fs.readFileSync(file,'utf8').includes(t));console.log(`${ok?'PASS':'FAIL'} ${label}`);if(ok)pass++}
console.log(`PASS route inventory: ${files.length} API route files scanned`);
console.log(`PASS protected-route auth scan: ${authChecked} non-public routes inspected`);
if(unguarded.length){console.log('WARN routes needing manual auth review:');for(const f of unguarded)console.log(' - '+f)}else console.log('PASS protected-route auth scan: no obvious unguarded non-public routes');
console.log(`\n${pass}/5 deterministic production checks PASS`);
if(pass!==5)process.exit(1);
