/**
 * NEXORA Risk & Anomaly Reasoning Kernel v1.
 *
 * Deterministic, read-only triage of unusual financial observations.
 * An anomaly is never treated as fraud, error, or a security incident by itself.
 */
export type RiskLevel = "info" | "watch" | "elevated";
export type RiskKind = "unusual_amount" | "budget_drift" | "cash_pressure" | "recurrence_change";
export type RiskSignal = {
  id: string;
  kind: RiskKind;
  label: string;
  level: RiskLevel;
  score: number;
  observedValue: number;
  referenceValue?: number;
  delta?: number;
  explanation: string;
  verificationQuestion: string;
};
export type RiskReasoningResult = {
  version: 1;
  signals: RiskSignal[];
  overall: RiskLevel;
  score: number;
  summary: string;
  limitations: string[];
  authority: { createsFacts: false; mutatesMemory: false; executesTools: false; authorizesFinancialWrite: false };
};

type Tx = { amount?: number|string; occurred_at?: string; label?: string; categories?: {name?:string}|Array<{name?:string}>|null };
const n=(v:unknown)=>{const x=Number(String(v??0).replace(",","."));return Number.isFinite(x)?x:0};
const r=(v:number)=>Math.round(v*100)/100;
const labelOf=(t:Tx)=>Array.isArray(t.categories)?(t.categories[0]?.name||t.label||"Non catégorisé"):(t.categories?.name||t.label||"Non catégorisé");
const monthOf=(s:string)=>s.slice(0,7);

export function runRiskReasoning(args:{transactions?:Tx[]; budgetDrifts?:Array<{name:string;planned:number;spent:number;variance:number;ratio:number;status:"over"|"near"|"on_track"}>; currentMonth?:string; safetyReserve?:number}):RiskReasoningResult {
  const tx=args.transactions??[];
  const current=args.currentMonth?.slice(0,7)||new Date().toISOString().slice(0,7);
  const currentTx=tx.filter(t=>monthOf(String(t.occurred_at||""))===current);
  const expenses=currentTx.filter(t=>n(t.amount)<0).map(t=>({amount:Math.abs(n(t.amount)),label:labelOf(t)}));
  const values=expenses.map(x=>x.amount);
  const avg=values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
  const signals:RiskSignal[]=[];

  for(const item of expenses.filter(x=>x.amount>=Math.max(100,avg*3)).sort((a,b)=>b.amount-a.amount).slice(0,5)){
    const ratio=avg?item.amount/avg:0;
    const score=Math.min(100,Math.round(45+Math.min(55,(ratio-3)*12)));
    signals.push({id:`amount-${item.label.toLowerCase().replace(/[^a-z0-9]+/gi,"-")}-${Math.round(item.amount*100)}`,kind:"unusual_amount",label:item.label,level:score>=75?"elevated":"watch",score,observedValue:r(item.amount),referenceValue:r(avg),delta:r(item.amount-avg),explanation:`Dépense de ${r(item.amount).toFixed(2)} €, soit environ ${ratio.toFixed(1)}× la moyenne des dépenses observées ce mois-ci.`,verificationQuestion:"Cette dépense est-elle attendue et correctement catégorisée ?"});
  }

  for(const drift of (args.budgetDrifts??[]).filter(d=>d.status!=="on_track").slice(0,5)){
    const score=drift.status==="over"?Math.min(95,60+Math.round(Math.max(0,drift.ratio-100)/2)):50;
    signals.push({id:`budget-${drift.name.toLowerCase().replace(/[^a-z0-9]+/gi,"-")}`,kind:"budget_drift",label:drift.name,level:drift.status==="over"?"elevated":"watch",score,observedValue:r(drift.spent),referenceValue:r(drift.planned),delta:r(drift.variance),explanation:`L'enveloppe est à ${r(drift.ratio).toFixed(0)} % du budget prévu.`,verificationQuestion:"Faut-il ajuster cette enveloppe ou s'agit-il d'une dépense ponctuelle ?"});
  }

  const income=currentTx.filter(t=>n(t.amount)>0).reduce((s,t)=>s+n(t.amount),0);
  const expensesTotal=values.reduce((a,b)=>a+b,0);
  const reserve=Math.max(0,n(args.safetyReserve));
  const net=income-expensesTotal;
  if(reserve>0 && net<reserve){
    const score=Math.min(95,65+Math.round(((reserve-net)/Math.max(reserve,1))*30));
    signals.push({id:"cash-pressure",kind:"cash_pressure",label:"Pression sur la réserve",level:"elevated",score,observedValue:r(net),referenceValue:r(reserve),delta:r(net-reserve),explanation:`Le flux net observé du mois (${r(net).toFixed(2)} €) est inférieur à la réserve de sécurité indiquée (${r(reserve).toFixed(2)} €).`,verificationQuestion:"La réserve doit-elle être protégée par une réduction ou un décalage de dépenses ?"});
  }

  signals.sort((a,b)=>b.score-a.score);
  const score=signals.length?Math.round(signals.slice(0,5).reduce((s,x)=>s+x.score,0)/Math.min(5,signals.length)):0;
  const overall=score>=75?"elevated":score>=50?"watch":"info";
  const summary=signals.length?`${signals.length} signal${signals.length>1?"aux":""} financier${signals.length>1?"s":""} mérite${signals.length>1?"nt":""} une vérification, sans conclure à une erreur ou à une fraude.`:"Aucun signal inhabituel significatif n'a été détecté dans les données disponibles.";
  return {version:1,signals,overall,score,summary,limitations:["Un signal d'anomalie indique une valeur inhabituelle, pas une fraude, une erreur ou un incident de sécurité.","L'analyse dépend des transactions et budgets disponibles; des données manquantes peuvent modifier le résultat.","Le score est un outil de triage et ne constitue pas une probabilité de fraude ni une décision financière."],authority:{createsFacts:false,mutatesMemory:false,executesTools:false,authorizesFinancialWrite:false}};
}

export function formatRiskReasoning(x:RiskReasoningResult):string {
  if(!x.signals.length)return "";
  const rows=x.signals.slice(0,3).map(s=>`- **${s.label}** · ${s.level === "elevated" ? "à vérifier en priorité" : "à surveiller"} — ${s.explanation} Question : ${s.verificationQuestion}`).join("\n");
  return `\n\n**Signaux à vérifier**\n${rows}\n\n${x.summary}\n*Le niveau de risque est un outil de triage : une anomalie ne constitue pas une preuve de fraude ou d'erreur.*`;
}
