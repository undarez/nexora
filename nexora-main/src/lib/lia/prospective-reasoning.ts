/** V5.08.36 — bounded financial outlook. Read-only, deterministic. */
export type OutlookLevel = "stable" | "watch" | "pressure";
export type FinancialOutlook = {
  version: 1;
  horizonDays: number;
  observedMonths: number;
  baseline: { monthlyIncome: number; monthlyExpenses: number; monthlyNet: number; currentBalance: number; projectedBalance: number };
  outlook: OutlookLevel;
  drivers: string[];
  assumptions: string[];
  warnings: string[];
  limitations: string[];
  authority: { readOnly: true; financialWrite: false; certainty: "conditional" };
};
const n=(v:unknown)=>{const x=Number(String(v??0).replace(",","."));return Number.isFinite(x)?x:0};
const r=(v:number)=>Math.round(v*100)/100;
export function runFinancialOutlook(args:{transactions?:Array<{amount?:number|string;occurred_at?:string}>;currentBalance?:number|string;horizonDays?:number;monthlyBudgetIncome?:number|string;monthlyBudgetExpenses?:number|string}):FinancialOutlook {
  const tx=args.transactions??[]; const horizon=Math.max(30,Math.min(180,args.horizonDays??90));
  const months=new Map<string,{income:number;expenses:number}>();
  for(const t of tx){const m=String(t.occurred_at??"").slice(0,7); if(!/^\d{4}-\d{2}$/.test(m))continue; const a=n(t.amount); const row=months.get(m)||{income:0,expenses:0}; if(a>=0)row.income+=a;else row.expenses+=Math.abs(a);months.set(m,row);}
  const keys=[...months.keys()].sort().slice(-6); const rows=keys.map(k=>months.get(k)!);
  const income=rows.length?rows.reduce((s,x)=>s+x.income,0)/rows.length:0; const expenses=rows.length?rows.reduce((s,x)=>s+x.expenses,0)/rows.length:0; const net=income-expenses;
  const budgetIncome=n(args.monthlyBudgetIncome)||income; const budgetExpenses=n(args.monthlyBudgetExpenses)||expenses; const current=n(args.currentBalance); const projected=current+net*(horizon/30);
  const warnings:string[]=[]; const drivers:string[]=[]; if(net<0)warnings.push("Le flux mensuel moyen observé est négatif."); if(projected<0)warnings.push("La projection conditionnelle devient négative sur l’horizon indiqué."); if(budgetExpenses>0&&expenses>budgetExpenses*1.1)drivers.push("Les dépenses observées dépassent de plus de 10 % le niveau budgété disponible."); if(budgetIncome>0&&income<budgetIncome*0.9)drivers.push("Les revenus observés sont inférieurs de plus de 10 % au niveau budgété disponible.");
  const level=projected<0||net<0?"pressure":(net<Math.max(1,income)*0.1?"watch":"stable");
  return {version:1,horizonDays:horizon,observedMonths:rows.length,baseline:{monthlyIncome:r(income),monthlyExpenses:r(expenses),monthlyNet:r(net),currentBalance:r(current),projectedBalance:r(projected)},outlook:level,drivers,assumptions:[`${rows.length} mois de transactions observées utilisés`,"Les flux moyens récents sont prolongés sur l’horizon demandé","Aucune nouvelle dépense ou recette exceptionnelle n'est supposée"],warnings,limitations:["Une projection conditionnelle n'est pas une prévision certaine.","Les revenus, dépenses exceptionnels et données manquantes peuvent modifier fortement le résultat.","Cette analyse ne constitue pas un conseil financier personnalisé."],authority:{readOnly:true,financialWrite:false,certainty:"conditional"}};
}
export function formatFinancialOutlook(x:FinancialOutlook){return `\n\n**Perspective financière (${x.horizonDays} jours)**\nFlux mensuel moyen observé : ${x.baseline.monthlyNet.toFixed(2)} €. Projection conditionnelle : ${x.baseline.projectedBalance.toFixed(2)} €. Niveau : **${x.outlook}**.${x.drivers.length?` ${x.drivers.join(" ")}`:""}${x.warnings.length?` ⚠️ ${x.warnings.join(" ")}`:""}\n*Il s'agit d'une projection conditionnelle fondée sur les données disponibles, pas d'une certitude.*`;}
