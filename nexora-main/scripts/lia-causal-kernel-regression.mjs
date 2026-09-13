import fs from 'node:fs';
const p = 'src/lib/lia/causal-kernel.ts';
const s = fs.readFileSync(p, 'utf8');
const required = [
  'runNexoraCausalKernel',
  'associated',
  'causal_candidate',
  'conflicted',
  'counterfactualAllowed',
  'causal_kernel_never_equates_correlation_with_causation',
  'createsFacts: false',
  'mutatesMemory: false',
  'authorizesFinancialWrite: false',
];
for (const x of required) if (!s.includes(x)) throw new Error(`missing:${x}`);
console.log('lia:causal-kernel PASS');
