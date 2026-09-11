import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const required=['src/lib/lia/agentic-supervisor.ts','src/app/api/lia/supervisor/route.ts','supabase/migrations/0082_agentic_supervisor_runtime_bridge.sql'];
for(const file of required){if(!fs.existsSync(path.join(root,file))) throw new Error(`missing:${file}`)}
const source=fs.readFileSync(path.join(root,'src/lib/lia/agentic-supervisor.ts'),'utf8');
for(const marker of ['knowledgeIsNotAuthorization','behaviourIsNotAuthorization','maxReplans','maxRetriesPerStep','lia_supervisor_record_run']) if(!source.includes(marker)) throw new Error(`missing_marker:${marker}`);
console.log('lia-agentic-supervisor-regression: PASS');
