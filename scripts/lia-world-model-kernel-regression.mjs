import fs from 'node:fs';
const p = 'src/lib/lia/world-model-kernel.ts';
const s = fs.readFileSync(p, 'utf8');
for (const x of ['buildNexoraWorldModel','descriptiveOnly: true','truthActivationAllowed: false','memoryMutationAllowed: false','toolExecutionAllowed: false','financialWriteAuthorization: false','contradictions_are_not_silently_resolved']) if (!s.includes(x)) throw new Error(`missing:${x}`);
console.log('lia:world-model-kernel PASS');
