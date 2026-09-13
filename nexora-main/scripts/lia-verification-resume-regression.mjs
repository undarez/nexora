import assert from 'node:assert/strict';
const src = await (await import('node:fs/promises')).readFile(new URL('../src/lib/lia/verification-engine.ts', import.meta.url), 'utf8');
assert.match(src, /verifyLiaStepOutput/);
assert.match(src, /proposal.status !== "executed"/);
assert.match(src, /status: "completed"/);
const runtime = await (await import('node:fs/promises')).readFile(new URL('../src/lib/lia/orchestrator-runtime.ts', import.meta.url), 'utf8');
assert.doesNotMatch(runtime, /current_step: step\.step_index, updated_at: now/);
assert.match(runtime, /verification_failed/);
console.log('✓ verification and resume contract');
