import fs from 'node:fs';
const p = 'src/lib/lia/knowledge-synthesis-kernel.ts';
const s = fs.readFileSync(p, 'utf8');
const required = [
  'synthesizeNexoraKnowledge', 'supported', 'tentative', 'conflicted', 'insufficient',
  'provenance', 'conflicts', 'independence', 'createsFacts: false', 'validatesTruth: false',
  'mutatesMemory: false', 'executesTools: false', 'authorizesFinancialWrite: false',
  'memoryGovernanceAuthoritative: true', 'decisionGateAuthoritative: true',
];
for (const x of required) if (!s.includes(x)) throw new Error(`missing:${x}`);
console.log('lia:knowledge-synthesis-kernel PASS');
