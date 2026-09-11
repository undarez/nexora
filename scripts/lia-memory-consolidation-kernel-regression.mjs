import fs from 'node:fs';
const p = 'src/lib/lia/memory-consolidation-kernel.ts';
const s = fs.readFileSync(p, 'utf8');
const required = ['consolidateNexoraMemory', 'durableMutationAuthorized: false', 'validationAuthorized: false', 'financialWriteAuthorized: false', 'provenance', 'quarantine'];
for (const x of required) if (!s.includes(x)) throw new Error(`missing:${x}`);
console.log('lia:memory-consolidation-kernel PASS');
