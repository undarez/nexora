import fs from 'node:fs';
const checks = [
 ['governance audit helper', fs.existsSync('src/lib/lia/governance-audit.ts')],
 ['audit migration', fs.existsSync('supabase/migrations/0102_lia_governance_audit_integrity.sql')],
 ['sha256 hash chain', fs.readFileSync('supabase/migrations/0102_lia_governance_audit_integrity.sql','utf8').includes("digest(payload,'sha256')")],
 ['authenticated insert blocked', fs.readFileSync('supabase/migrations/0102_lia_governance_audit_integrity.sql','utf8').includes('revoke insert, update, delete on public.lia_governance_audit from public, anon, authenticated')],
 ['chat recommendation audited', fs.readFileSync('src/app/api/lia/chat/route.ts','utf8').includes('recommendation_generated')],
 ['action proposal audited', fs.readFileSync('src/app/api/lia/actions/plan/route.ts','utf8').includes('action_proposal_created')],
 ['sensitive fields sanitized', fs.readFileSync('src/lib/lia/governance-audit.ts','utf8').includes('access_token')],
 ['verification function', fs.readFileSync('supabase/migrations/0102_lia_governance_audit_integrity.sql','utf8').includes('verify_lia_governance_audit')],
 ['package version is not regressed', (() => { const v=JSON.parse(fs.readFileSync('package.json','utf8')).version.split('.').map(Number); return v[0]>0 || v[1]>1 || v[2]>=95; })()],
];
let pass=0; for (const [name,ok] of checks) { console.log(`${ok?'PASS':'FAIL'} ${name}`); if(ok) pass++; }
if(pass!==checks.length) process.exit(1); console.log(`V5.08.45: ${pass}/${checks.length} PASS`);
