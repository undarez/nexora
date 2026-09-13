/** V5.08.37 — bounded mail-to-finance signal extraction. Metadata only, no autonomous action. */
export type MailFinancialSignalKind = "invoice"|"payment_due"|"banking"|"subscription"|"unknown";
export type MailFinancialSignal = { kind:MailFinancialSignalKind; confidence:"low"|"medium"|"high"; reason:string; messageId:string };
const rules:[MailFinancialSignalKind,RegExp][]=[
 ["invoice",/\b(facture|invoice|facturation|bill)\b/i],
 ["payment_due",/\b(échéance|echeance|due|payment due|paiement|prélèvement|prelevement)\b/i],
 ["banking",/\b(banque|bank|virement|transfer|compte|account|carte|card|crédit|credit)\b/i],
 ["subscription",/\b(abonnement|subscription|renewal|renouvellement)\b/i],
];
export function extractMailFinancialSignals(messages:Array<{id:string;subject?:string;snippet?:string}>):MailFinancialSignal[]{
 return messages.slice(0,30).map((m):MailFinancialSignal=>{
  const text=`${m.subject??""} ${m.snippet??""}`.slice(0,600);
  const hit=rules.find(([,r])=>r.test(text));
  return hit?{kind:hit[0],confidence:"medium",reason:"Motifs financiers détectés dans les métadonnées du message.",messageId:m.id}:{kind:"unknown",confidence:"low",reason:"Aucun motif financier suffisamment clair dans les métadonnées.",messageId:m.id};
 }).filter(x=>x.kind!=="unknown");
}
export function summarizeMailSignals(messages:Array<{id:string;subject?:string;snippet?:string}>){
 const signals=extractMailFinancialSignals(messages); return {count:signals.length,byKind:signals.reduce<Record<string,number>>((a,s)=>(a[s.kind]=(a[s.kind]??0)+1,a),{}),signals,authority:{readOnly:true,bodyAccess:false,attachmentsAccess:false,actionExecution:false}};
}