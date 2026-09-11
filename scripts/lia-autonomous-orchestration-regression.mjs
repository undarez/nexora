import assert from 'node:assert/strict';
import fs from 'node:fs';
const runtime = fs.readFileSync('src/lib/lia/orchestrator-runtime.ts','utf8');
const route = fs.readFileSync('src/app/api/lia/orchestrate/run/route.ts','utf8');
const verify = fs.readFileSync('src/lib/lia/verification-engine.ts','utf8');
for (const token of ['runLiaOrchestration','advanceLiaOrchestration','executeAgentTool','runLiveResearch','human_gate_sensitive_action']) assert.ok(runtime.includes(token), `runtime missing ${token}`);
for (const token of ['runLiaOrchestration','run_id']) assert.ok(route.includes(token), `route missing ${token}`);
for (const token of ['required_path','verified === true']) assert.ok(verify.includes(token), `verification missing ${token}`);
console.log('✓ autonomous orchestration contract');
