import fs from 'node:fs';
const p = 'src/lib/lia/temporal-world-model-kernel.ts';
const s = fs.readFileSync(p, 'utf8');
for (const x of ['buildNexoraTemporalWorldModel','currentNodeIds','futureNodeIds','expiredNodeIds','undatedNodeIds','expired_does_not_mean_false','financialWriteAuthorization: false']) if (!s.includes(x)) throw new Error(`missing:${x}`);
console.log('lia:temporal-world-model-kernel PASS');
