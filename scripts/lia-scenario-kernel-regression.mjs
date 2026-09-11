import fs from 'node:fs';
const p = 'src/lib/lia/scenario-kernel.ts';
const s = fs.readFileSync(p, 'utf8');
const required = [
  'runNexoraScenarioKernel',
  'baseline',
  'counterfactual',
  'stress',
  'conditional',
  'counterfactual_requires_stronger_causal_support',
  'scenario_kernel_never_presents_projection_as_fact',
  'createsFacts: false',
  'mutatesMemory: false',
  'executesTools: false',
  'authorizesFinancialWrite: false',
];
for (const x of required) if (!s.includes(x)) throw new Error(`missing:${x}`);
console.log('lia:scenario-kernel PASS');
