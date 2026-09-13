import fs from 'node:fs';
const migration=fs.readFileSync('supabase/migrations/0062_lia_action_lifecycle.sql','utf8');
const route=fs.readFileSync('src/app/api/lia/actions/execute/route.ts','utf8');
for (const token of ['status in (\'proposed\',\'approved\',\'executing\',\'rejected\',\'executed\',\'rolled_back\',\'expired\',\'failed\')','claim_lia_action_for_execution','execution_attempts','execution_claimed']) if(!migration.includes(token)) throw new Error(`missing migration token: ${token}`);
for (const token of ['claim_lia_action_for_execution','eq("status","executing")','execution_failed','verified_at']) if(!route.includes(token)) throw new Error(`missing runtime token: ${token}`);
console.log('✓ action lifecycle contract');
