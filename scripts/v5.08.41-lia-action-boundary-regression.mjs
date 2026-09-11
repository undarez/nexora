import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root,p),'utf8');
const boundary = read('src/lib/lia/actions/boundary.ts');
const planner = read('src/lib/lia/actions/planner.ts');
const execute = read('src/app/api/lia/actions/execute/route.ts');
const migration = fs.readdirSync(path.join(root,'supabase/migrations')).map(f=>read(path.join('supabase/migrations',f))).join('\n');
const tests = [
  ['allow-list exists', boundary.includes('const ACTIONS') && boundary.includes('create_recommendation')],
  ['unknown actions rejected', boundary.includes('return ACTIONS[actionKey] ?? null')],
  ['planning is server-gated', planner.includes('assertLiaActionCanBePlanned')],
  ['human approval required', boundary.includes('requiresHumanApproval: true')],
  ['execution checks approval', execute.includes('assertLiaActionCanBeExecuted(p.action_key, p.status === "approved")')],
  ['non-reversible execution rejected', execute.includes('if(!p.reversible)')],
  ['direct financial mutation blocked', boundary.includes('mutatesFinancialState) throw')],
  ['policy engine remains server-only', migration.includes('grant execute on function public.authorize_lia_tool') && migration.includes('to service_role')],
  ['proposal creation is not client-insertable', migration.includes('revoke insert, delete on public.lia_action_proposals from authenticated')],
  ['approval is RPC gated', migration.includes('approve_lia_action')],
  ['no new financial action enabled', !boundary.includes('transfer_money') && !boundary.includes('delete_transaction')],
];
let failed=0; for(const [name,ok] of tests){ console.log(`${ok?'PASS':'FAIL'} ${name}`); if(!ok) failed++; }
if(failed) process.exit(1); console.log(`\n${tests.length}/${tests.length} PASS`);
