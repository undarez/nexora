import { runRiskReasoning, formatRiskReasoning } from '../src/lib/lia/risk-reasoning.ts';
const result=runRiskReasoning({currentMonth:'2026-09',transactions:[
 {amount:1000,occurred_at:'2026-09-01',label:'Salaire'},
 {amount:-50,occurred_at:'2026-09-02',label:'Courses'},
 {amount:-50,occurred_at:'2026-09-03',label:'Courses'},
 {amount:-50,occurred_at:'2026-09-04',label:'Courses'},
 {amount:-50,occurred_at:'2026-09-05',label:'Courses'},
 {amount:-900,occurred_at:'2026-09-06',label:'Achat exceptionnel'},
],budgetDrifts:[{name:'Loisirs',planned:200,spent:260,variance:60,ratio:130,status:'over'}],safetyReserve:500});
const checks=[
 ['signal montant inhabituel',result.signals.some(s=>s.kind==='unusual_amount')],
 ['signal budget',result.signals.some(s=>s.kind==='budget_drift')],
 ['niveau global',result.overall==='elevated'],
 ['score borné',result.score>=0&&result.score<=100],
 ['question verification',result.signals.every(s=>s.verificationQuestion.length>0)],
 ['pas accusation',result.limitations[0].includes('fraude')],
 ['read only',result.authority.createsFacts===false&&result.authority.authorizesFinancialWrite===false],
 ['format non vide',formatRiskReasoning(result).length>0],
 ['pas de faux montant',!formatRiskReasoning(result).includes('probabilité de fraude')],
 ['version',result.version===1],
];
for(const [name,ok] of checks) console.log(`${ok?'PASS':'FAIL'} ${name}`); if(checks.some(([,ok])=>!ok)) process.exit(1);
