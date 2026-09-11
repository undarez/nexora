import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const required = [
 'src/lib/lia/learning-evidence-pack.ts',
 'src/lib/lia/agent-evaluation-suite.ts',
 'src/lib/lia/orchestrator.ts',
 'src/lib/lia/orchestrator-runtime.ts',
 'src/lib/lia/proactive/loop.ts',
 'src/lib/lia/production-telemetry.ts',
 'src/lib/lia/production-correlation.ts',
 'src/app/api/lia/orchestrate/run/route.ts',
 'src/app/api/lia/proactive/loop/route.ts',
 'src/app/api/admin/lia/learning-evidence/route.ts',
 'src/lib/agent-runtime/tool-registry.ts',
];
const missing = required.filter(f => !fs.existsSync(path.join(root,f)));
if (missing.length) throw new Error(`Missing: ${missing.join(', ')}`);
const evidence = fs.readFileSync(path.join(root,'src/lib/lia/learning-evidence-pack.ts'),'utf8');
const suite = fs.readFileSync(path.join(root,'src/lib/lia/agent-evaluation-suite.ts'),'utf8');
const checks = [
 ['evidence no raw content', /rawContentStored:\s*false/.test(evidence)],
 ['evidence no auto promotion', /automaticPromotionAllowed:\s*false/.test(evidence)],
 ['evidence no auto activation', /automaticActivationAllowed:\s*false/.test(evidence)],
 ['evaluation has security cases', /permissions/.test(suite) && /security/.test(suite)],
 ['evaluation blocks critical', /criticalFailure/.test(suite)],
 ['bounded orchestration', /Math\.min\(5/.test(fs.readFileSync(path.join(root,'src/lib/lia/orchestrator-runtime.ts'),'utf8'))],
 ['proactive loop exists', /runProactiveFinancialLoop/.test(fs.readFileSync(path.join(root,'src/app/api/lia/proactive/loop/route.ts'),'utf8'))],
 ['tool registry exists', /AGENT_TOOLS/.test(fs.readFileSync(path.join(root,'src/lib/agent-runtime/tool-registry.ts'),'utf8'))],
 ['production telemetry privacy', /never raw prompts\/responses/.test(fs.readFileSync(path.join(root,'src/lib/lia/production-telemetry.ts'),'utf8'))],
 ['correlation observational', /observational evidence/.test(fs.readFileSync(path.join(root,'src/lib/lia/production-correlation.ts'),'utf8'))],
 ['admin evidence route', /requireAdmin/.test(fs.readFileSync(path.join(root,'src/app/api/admin/lia/learning-evidence/route.ts'),'utf8'))],
 ['migration evidence table', fs.existsSync(path.join(root,'supabase/migrations/0111_lia_learning_evidence_pack.sql'))],
];
let pass=0; for(const [name,ok] of checks){ console.log(`${ok?'PASS':'FAIL'} ${name}`); if(ok) pass++; }
if(pass!==checks.length) process.exit(1);
console.log(`${pass}/${checks.length} PASS`);
