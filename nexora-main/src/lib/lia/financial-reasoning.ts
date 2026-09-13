/** Deterministic financial reasoning layer. It explains observed movements without
 * claiming causality when the available data only supports association. */
export type FinancialReasoningDriver = {
  label: string; amount: number; shareOfChange: number; direction: "increase" | "decrease";
};
export type FinancialReasoningResult = {
  version: 2;
  period: { current: string; previous: string };
  current: { income: number; expenses: number; net: number };
  previous: { income: number; expenses: number; net: number };
  drivers: FinancialReasoningDriver[];
  conclusions: string[];
  confidence: number;
  limitations: string[];
  counterfactualAllowed: false;
  trends: Array<{ metric: "income" | "expenses" | "net"; direction: "up" | "down" | "stable"; rate: number }>;
  recurring: Array<{ label: string; averageAmount: number; occurrences: number; cadence: "monthly" | "frequent" }>;
  anomalies: Array<{ label: string; amount: number; reason: string }>;
};

type Tx = { amount?: number|string; occurred_at?: string; label?: string; categories?: {name?:string}|Array<{name?:string}>|null };
const n=(v:unknown)=>{const x=Number(String(v??0).replace(",","."));return Number.isFinite(x)?x:0};
const cat=(t:Tx)=>Array.isArray(t.categories)?(t.categories[0]?.name||"Non catégorisé"):(t.categories?.name||"Non catégorisé");
const month=(s:string)=>s.slice(0,7);


function round2(v:number){ return Math.round(v*100)/100; }

function buildAdvancedSignals(transactions: Tx[], current: string, previous: string) {
  const months = new Map<string, {income:number; expenses:number; net:number}>();
  for (const tx of transactions) {
    const m=month(String(tx.occurred_at||""));
    if (!/^\d{4}-\d{2}$/.test(m)) continue;
    const amount=n(tx.amount);
    const row=months.get(m)||{income:0,expenses:0,net:0};
    if(amount>=0) row.income+=amount; else row.expenses+=Math.abs(amount);
    row.net=row.income-row.expenses; months.set(m,row);
  }
  const keys=[...months.keys()].sort().slice(-6);
  const trends: Array<{ metric: "income" | "expenses" | "net"; direction: "up" | "down" | "stable"; rate: number }> = (["income", "expenses", "net"] as const).map(metric=>{
    const vals=keys.map(k=>months.get(k)?.[metric]||0);
    const first=vals[0]||0, last=vals[vals.length-1]||0;
    const rate=first?((last/first)-1)*100:0;
    const direction: "up" | "down" | "stable" = Math.abs(last-first)<0.01?"stable":last>first?"up":"down";
    return {metric,direction,rate:round2(rate)};
  });

  const groups=new Map<string, {amounts:number[]; months:Set<string>}>();
  for(const tx of transactions){
    const amount=n(tx.amount); if(amount>=0) continue;
    const label=(tx.label||"Dépense").trim().toLowerCase()||"dépense";
    const g=groups.get(label)||{amounts:[],months:new Set<string>()};
    g.amounts.push(Math.abs(amount)); const m=month(String(tx.occurred_at||"")); if(m) g.months.add(m); groups.set(label,g);
  }
  const recurring=[...groups.entries()]
    .map(([label,g])=>({label,averageAmount:round2(g.amounts.reduce((a,b)=>a+b,0)/g.amounts.length),occurrences:g.amounts.length,cadence:g.months.size>=2?"monthly" as const:"frequent" as const}))
    .filter(x=>x.occurrences>=2)
    .sort((a,b)=>b.averageAmount-a.averageAmount).slice(0,8);

  const expenses=transactions.filter(t=>n(t.amount)<0).map(t=>({label:t.label||"Dépense",amount:Math.abs(n(t.amount))}));
  const vals=expenses.map(x=>x.amount); const avg=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0;
  const anomalies=expenses.filter(x=>x.amount>=Math.max(100,avg*3)).sort((a,b)=>b.amount-a.amount).slice(0,6)
    .map(x=>({label:x.label,amount:round2(x.amount),reason:"montant au moins 3× supérieur à la moyenne des dépenses observées"}));
  return {trends,recurring,anomalies};
}

export function runFinancialReasoning(args:{transactions:Tx[]; currentMonth?:string}):FinancialReasoningResult {
  const current=args.currentMonth?.slice(0,7)||new Date().toISOString().slice(0,7);
  const d=new Date(`${current}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth()-1);
  const previous=d.toISOString().slice(0,7);
  const summarize=(m:string)=>{
    const tx=args.transactions.filter(t=>month(String(t.occurred_at||""))===m);
    const income=tx.filter(t=>n(t.amount)>0).reduce((s,t)=>s+n(t.amount),0);
    const expenses=tx.filter(t=>n(t.amount)<0).reduce((s,t)=>s+Math.abs(n(t.amount)),0);
    const by=new Map<string,number>();
    tx.filter(t=>n(t.amount)<0).forEach(t=>by.set(cat(t),(by.get(cat(t))||0)+Math.abs(n(t.amount))));
    return {income,expenses,net:income-expenses,by};
  };
  const c=summarize(current), p=summarize(previous);
  const drivers=[...new Set([...c.by.keys(),...p.by.keys()])].map(label=>{
    const delta=(c.by.get(label)||0)-(p.by.get(label)||0);
    return {label,delta};
  }).filter(x=>Math.abs(x.delta)>0.01).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)).slice(0,5);
  const totalChange=Math.abs(c.expenses-p.expenses);
  const mapped=drivers.map(x=>({label:x.label,amount:Math.abs(x.delta),shareOfChange:totalChange?Math.round(Math.abs(x.delta)/totalChange*100):0,direction:x.delta>=0?"increase" as const:"decrease" as const}));
  const conclusions:string[]=[];
  if(c.expenses>p.expenses && p.expenses>0) conclusions.push(`Les dépenses observées augmentent de ${Math.round((c.expenses/p.expenses-1)*100)} % par rapport au mois précédent.`);
  else if(c.expenses<p.expenses && p.expenses>0) conclusions.push(`Les dépenses observées diminuent de ${Math.round((1-c.expenses/p.expenses)*100)} % par rapport au mois précédent.`);
  if(c.income!==p.income && p.income>0) conclusions.push(`Les revenus observés évoluent de ${Math.round((c.income/p.income-1)*100)} % par rapport au mois précédent.`);
  if(mapped[0]) conclusions.push(`Le principal mouvement par catégorie observée est « ${mapped[0].label} » (${mapped[0].direction === "increase" ? "+" : "-"}${mapped[0].amount.toFixed(2)} €).`);
  if(c.net<p.net) conclusions.push("Le solde des flux du mois est moins favorable que le mois précédent sur les données observées.");
  const confidence=args.transactions.length>=20?90:args.transactions.length>=5?75:55;
  return {version:2,period:{current,previous},current:{income:c.income,expenses:c.expenses,net:c.net},previous:{income:p.income,expenses:p.expenses,net:p.net},drivers:mapped,conclusions,confidence,limitations:["Analyse fondée sur les transactions disponibles; les flux non importés peuvent modifier le constat.","Une variation observée par catégorie n'établit pas à elle seule une causalité."],counterfactualAllowed:false, ...buildAdvancedSignals(args.transactions, current, previous)};
}

export function formatFinancialReasoning(result:FinancialReasoningResult):string {
  if(!result.conclusions.length) return "";
  const recurring=result.recurring.slice(0,3).map(r=>`- ${r.label} : ${r.occurrences} occurrence(s), moyenne ${r.averageAmount.toFixed(2)} €`).join("\n");
  const anomalies=result.anomalies.slice(0,3).map(a=>`- ${a.label} : ${a.amount.toFixed(2)} € — ${a.reason}`).join("\n");
  const drivers=result.drivers.slice(0,3).map(d=>`- ${d.label} : ${d.direction === "increase" ? "+" : "-"}${d.amount.toFixed(2)} €`).join("\n");
  return `\n\n**Lecture LIA**\n${result.conclusions.join(" ")}\n${drivers}${recurring?`\n\n**Récurrences observées**\n${recurring}`:""}${anomalies?`\n\n**Anomalies à vérifier**\n${anomalies}`:""}\n\n*Confiance : ${result.confidence} %. Constat fondé sur les données disponibles, sans attribution automatique de causalité.*`;
}
