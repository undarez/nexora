export type WatchTransaction = { id: string; label: string; amount: number; occurred_at: string };
export type FinancialSignal = { id: string; severity: "info" | "warning" | "danger"; title: string; message: string; actionHref: string; evidence: Record<string, number | string> };

const euro = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const key = (s: string) => s.toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
const median = (xs: number[]) => { const a = [...xs].sort((x,y)=>x-y); if (!a.length) return 0; const m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2; };

/** Deterministic, read-only signals. No LLM and no financial mutation. */
export function detectFinancialSignals(transactions: WatchTransaction[], balance: number, reserve: number, now = new Date()): FinancialSignal[] {
  const signals: FinancialSignal[] = [];
  const expenses = transactions.filter(t => Number(t.amount) < 0).map(t => ({...t, amount: Math.abs(Number(t.amount))}));
  const recent = expenses.filter(t => now.getTime() - new Date(t.occurred_at).getTime() <= 7*86400000);
  const history = expenses.filter(t => now.getTime() - new Date(t.occurred_at).getTime() <= 90*86400000);
  const baselines = new Map<string, number[]>();
  for (const t of history) { const k=key(t.label); baselines.set(k,[...(baselines.get(k)??[]),t.amount]); }
  for (const t of recent) {
    const base=median((baselines.get(key(t.label))??[]).filter(v=>v!==t.amount));
    if (base >= 20 && t.amount >= Math.max(base*2, base+50)) {
      signals.push({id:`unusual:${t.id}`,severity:t.amount>=Math.max(base*3,base+150)?"danger":"warning",title:"Dépense inhabituelle",message:`« ${t.label} » est à ${euro(t.amount)}, contre une référence habituelle d’environ ${euro(base)}.`,actionHref:"/transactions",evidence:{transactionId:t.id,amount:t.amount,baseline:base}});
    }
  }
  if (reserve > 0 && balance < reserve) {
    signals.push({id:"reserve:below",severity:"danger",title:"Réserve de sécurité sous le seuil",message:`Le solde consolidé (${euro(balance)}) est inférieur à la réserve configurée (${euro(reserve)}).`,actionHref:"/previsions",evidence:{balance,reserve}});
  }
  return signals.slice(0,8);
}
