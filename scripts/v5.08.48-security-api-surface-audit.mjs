import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('src/app/api');
const files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(e.name==='route.ts')files.push(p)}}
walk(root);
const failures=[];
const findings=[];
for(const file of files){
  const s=fs.readFileSync(file,'utf8');
  const rel=path.relative(process.cwd(),file);
  const mutating=/export async function (POST|PUT|PATCH|DELETE)\b/.test(s);
  const webhook=/webhook[\\/]/.test(rel);
  const callback=/callback[\\/]/.test(rel);
  const cron=/runtime[\\/]cron/.test(rel) || /authorized\(request\)/.test(s);
  const authEndpoint=/^src[\\/]app[\\/]api[\\/]auth[\\/]/.test(rel);
  if(mutating && !webhook && !cron && !authEndpoint && !/assertSameOrigin\((?:request|req)\)/.test(s)) failures.push(`${rel}: mutating route without same-origin guard`);
  if(/requireAdmin\(supabase\)|getAdminContext\(supabase\)/.test(s)) findings.push(`${rel}: admin authorization guard present`);
  if(/SUPABASE_(SECRET|SERVICE_ROLE)_KEY/.test(s) && !(/requireAdmin\(supabase\)|getAdminContext\(supabase\)|authorized\(request\)/.test(s))){
    findings.push(`${rel}: service-role access requires ownership/RLS review`);
  }
  if(!webhook && !callback && /admin\.from\("(transactions|bank_transactions|bank_accounts|bank_connections)"\)/.test(s) && !/\.eq\("user_id",\s*user\.id\)/.test(s)) failures.push(`${rel}: privileged financial query missing obvious user ownership predicate`);
}
if(failures.length){console.error('V5.08.48 FAIL'); for(const x of failures) console.error(' - '+x); process.exit(1)}
console.log('V5.08.48 PASS');
console.log(`Routes audited: ${files.length}`);
console.log(`Informational findings: ${findings.length}`);
