import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src/lib/lia/reflection-kernel.ts', 'utf8');
assert.match(source, /runNexoraReflectionKernel/);
assert.match(source, /memoryMutationAuthorized: false/);
assert.match(source, /financialWriteAuthorized: false/);
assert.match(source, /evidence_gap/);
assert.match(source, /failure_pattern/);
assert.match(source, /success_pattern/);
assert.match(source, /policyEngineAuthoritative/);
assert.match(source, /decisionGateAuthoritative/);
console.log('lia-reflection-kernel: PASS');
