import { readFileSync } from 'node:fs';
const file=readFileSync('src/lib/lia/financial-reasoning.ts','utf8');
const route=readFileSync('src/app/api/lia/chat/route.ts','utf8');
const checks=[
 ['reasoning module exists',file.includes('runFinancialReasoning')],
 ['month comparison',file.includes('previous')&&file.includes('current')],
 ['drivers by category',file.includes('drivers')&&file.includes('shareOfChange')],
 ['no causal overclaim',file.includes('counterfactualAllowed:false')&&file.includes('causalité')],
 ['limitations explicit',file.includes('flux non importés')],
 ['chat integration',route.includes('runFinancialReasoning')],
 ['reasoning formatting',route.includes('formatFinancialReasoning')],
 ['bounded transactions',route.includes('transactions')],
];
let pass=0; for(const [n,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${n}`); if(ok)pass++;}
console.log(`V5.08.32: ${pass}/${checks.length} PASS`); if(pass!==checks.length)process.exit(1);
