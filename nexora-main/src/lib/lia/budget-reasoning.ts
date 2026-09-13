/** Budget vs actual + bounded scenario reasoning. Read-only and deterministic. */
export type BudgetEnvelope = { id?: string; name?: string; planned?: number|string; spent?: number|string; manual_spent?: number|string };
export type BudgetReasoningResult = {
  version: 1;
  available: boolean;
  observed: { income: number; expenses: number; net: number };
  planned: { income: number; expenses: number; net: number; reserve: number };
  variance: { income: number; expenses: number; net: number };
  drifts: Array<{ name: string; planned: number; spent: number; variance: number; ratio: number; status: "over"|"near"|"on_track" }>;
  baseline: { projectedBalance: number; assumptions: string[] } | null;
  scenarios: Array<{ name: string; projectedBalance: number; delta: number; assumptions: string[]; status: "conditional" }>;
  warnings: string[];
  limitations: string[];
};
const n=(v:unknown)=>{const x=Number(String(v??0).replace(",","."));return Number.isFinite(x)?x:0};
const r=(v:number)=>Math.round(v*100)/100;
export function runBudgetReasoning(args:{transactions?:Array<{amount?:number|string;occurred_at?:string}>; month:string; scenario?:{income?:number|string;starting_balance?:number|string;safety_reserve?:number|string;extra_expense?:number|string;envelopes?:BudgetEnvelope[]}|null; fixedExpenses?:Array<{amount?:number|string}>}):BudgetReasoningResult {
  const month=args.month.slice(0,7); const tx=(args.transactions??[]).filter(t=>String(t.occurred_at??"").slice(0,7)===month);
  const income=tx.filter(t=>n(t.amount)>0).reduce((s,t)=>s+n(t.amount),0);
  const expenses=tx.filter(t=>n(t.amount)<0).reduce((s,t)=>s+Math.abs(n(t.amount)),0);
  const sc=args.scenario; const envelopes=sc?.envelopes??[]; const plannedIncome=n(sc?.income);
  const plannedEnvelope= envelopes.reduce((s,e)=>s+Math.max(0,n(e.planned)),0);
  const fixed=(args.fixedExpenses??[]).reduce((s,e)=>s+Math.max(0,n(e.amount)),0);
  const plannedExpenses=plannedEnvelope+fixed+n(sc?.extra_expense);
  const reserve=n(sc?.safety_reserve); const starting=n(sc?.starting_balance);
  const baseline=sc?{projectedBalance:r(starting+(plannedIncome||income)-plannedExpenses),assumptions:[plannedIncome?"revenu planifié":"revenu observé faute de revenu planifié",`${r(fixed)} € de charges fixes connues`,`${r(plannedEnvelope)} € d'enveloppes planifiées`,`${r(n(sc?.extra_expense))} € de dépenses supplémentaires prévues`]}:null;
  const drifts=envelopes.map((e,i)=>{const p=Math.max(0,n(e.planned));const spent=Math.max(0,n(e.spent)+n(e.manual_spent));const ratio=p?spent/p:0;return {name:(e.name||e.id||`Enveloppe ${i+1}`),planned:r(p),spent:r(spent),variance:r(spent-p),ratio:r(ratio*100),status:spent>p?"over" as const:ratio>=.8?"near" as const:"on_track" as const}}).sort((a,b)=>b.variance-a.variance);
  const scenarios=baseline?[{name:"-10 % de revenus",projectedBalance:r(baseline.projectedBalance-(plannedIncome||income)*.1),delta:r(-(plannedIncome||income)*.1),assumptions:["revenus -10 %","charges et enveloppes inchangées"],status:"conditional" as const},{name:"+10 % de dépenses",projectedBalance:r(baseline.projectedBalance-(plannedExpenses*.1)),delta:r(-(plannedExpenses*.1)),assumptions:["dépenses +10 %","revenus inchangés"],status:"conditional" as const}]:[];
  const warnings:string[]=[]; if(baseline&&baseline.projectedBalance<0) warnings.push("La projection de référence devient négative."); if(baseline&&reserve>0&&baseline.projectedBalance<reserve) warnings.push("La projection de référence passe sous la réserve de sécurité."); if(drifts.some(d=>d.status==="over")) warnings.push("Au moins une enveloppe est déjà dépassée.");
  return {version:1,available:Boolean(sc||envelopes.length),observed:{income:r(income),expenses:r(expenses),net:r(income-expenses)},planned:{income:r(plannedIncome),expenses:r(plannedExpenses),net:r(plannedIncome-plannedExpenses),reserve:r(reserve)},variance:{income:r(income-plannedIncome),expenses:r(expenses-plannedExpenses),net:r((income-expenses)-(plannedIncome-plannedExpenses))},drifts,baseline,scenarios,warnings,limitations:["Le budget et les scénarios sont des hypothèses de planification, pas des transactions réelles.","Une projection ne garantit pas le solde futur.","Les données importées ou manquantes peuvent modifier l'écart constaté."]};
}
export function formatBudgetReasoning(x:BudgetReasoningResult){if(!x.available)return "\n\n**Budget / scénario**\nAucun scénario budgétaire exploitable n’est disponible pour ce mois.";const lines=[`**Budget vs réel** · revenus observés ${x.observed.income.toFixed(2)} € · dépenses observées ${x.observed.expenses.toFixed(2)} €.`,`Écart de dépenses vs plan : ${x.variance.expenses>=0?"+":""}${x.variance.expenses.toFixed(2)} €.`];if(x.drifts[0])lines.push(`Principale dérive : « ${x.drifts[0].name} » (${x.drifts[0].variance>=0?"+":""}${x.drifts[0].variance.toFixed(2)} €).`);if(x.baseline)lines.push(`Projection de référence : ${x.baseline.projectedBalance.toFixed(2)} €.`);if(x.warnings.length)lines.push(`⚠️ ${x.warnings.join(" ")}`);return "\n\n"+lines.join(" ")+"\n*Les scénarios sont conditionnels et ne constituent pas une prévision certaine.*";}
