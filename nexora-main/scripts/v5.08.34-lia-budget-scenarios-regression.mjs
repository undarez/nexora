import { runBudgetReasoning, formatBudgetReasoning } from '../src/lib/lia/budget-reasoning.ts';
const result=runBudgetReasoning({month:'2026-09-01',transactions:[{amount:3000,occurred_at:'2026-09-05'},{amount:-800,occurred_at:'2026-09-06'}],scenario:{income:3000,starting_balance:1000,safety_reserve:500,envelopes:[{name:'Logement',planned:700,spent:800},{name:'Vie',planned:500,spent:200}]},fixedExpenses:[{amount:300}]});
const checks=[
 ['budget disponible',result.available],
 ['réel calculé',result.observed.expenses===800],
 ['dérive détectée',result.drifts[0]?.status==='over'],
 ['baseline conditionnelle',Boolean(result.baseline)],
 ['stress revenus',result.scenarios.some(s=>s.name.includes('revenus'))],
 ['stress dépenses',result.scenarios.some(s=>s.name.includes('dépenses'))],
 ['scénarios conditionnels',result.scenarios.every(s=>s.status==='conditional')],
 ['warnings présents',result.warnings.length>0],
 ['limitations présentes',result.limitations.length>=2],
 ['format non vide',formatBudgetReasoning(result).length>0],
];
for(const [name,ok] of checks) console.log(`${ok?'PASS':'FAIL'} ${name}`); if(checks.some(([,ok])=>!ok)) process.exit(1);
