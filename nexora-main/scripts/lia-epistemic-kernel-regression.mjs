import fs from 'node:fs';
const p = 'src/lib/lia/epistemic-kernel.ts';
const s = fs.readFileSync(p, 'utf8');
const required = [
  'runNexoraEpistemicKernel',
  'known',
  'probable',
  'unknown',
  'conflicted',
  'stale',
  'createsFacts: false',
  'mutatesMemory: false',
  'authorizesFinancialWrite: false',
  'conflicts_require_reconciliation',
  'unknown_is_not_false',
];
for (const x of required) if (!s.includes(x)) throw new Error(`missing:${x}`);
console.log('lia:epistemic-kernel PASS');
