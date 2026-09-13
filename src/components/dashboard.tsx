"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarDays, ShieldCheck, Sparkles, Plus, ArrowRight, PiggyBank, Target, ChevronRight, Landmark, TrendingUp, CircleDollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { supervise } from "@/lib/agents/supervisor";
import { BalanceHistoryCard } from "@/components/finance/balance-history-card";
import type { UnifiedFinancialContext } from "@/lib/finance/unified-financial-context";

type FixedExpense = { id: string; label: string; sector: string; amount: number; recurrence: string; effective_from: string; effective_until: string | null; is_active: boolean };
type RecentTx = { id: string; label: string; amount: number; date: string; category: string; source: "bank" | "manual" };

const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
const monthLabel = (v: string) => new Intl.DateTimeFormat("fr-FR",{month:"long",year:"numeric"}).format(new Date(`${v}T12:00:00`));
const money = (v: number) => new Intl.NumberFormat("fr-FR",{maximumFractionDigits:0}).format(v);

export function Dashboard(){
 const [month] = useState(monthKey());
 const [financialContext,setFinancialContext]=useState<UnifiedFinancialContext|null>(null);
 const [fixedExpenses,setFixedExpenses]=useState<FixedExpense[]>([]);
 const [realBalance,setRealBalance]=useState(0);
 const [realIncome,setRealIncome]=useState(0);
 const [analysisBusy,setAnalysisBusy]=useState(false);
 const [analysisError,setAnalysisError]=useState("");
 const [displayName,setDisplayName]=useState("");
 const [recentTransactions,setRecentTransactions]=useState<RecentTx[]>([]);

 const load = useCallback(async () => {
   const supabase=getSupabaseBrowserClient(); if(!supabase) return;
   const {data:{user}}=await supabase.auth.getUser(); if(!user){return;}
   try {
     const [contextResponse, profile, bankRecent, manualRecent] = await Promise.all([
       fetch(`/api/finance/unified-context?month=${encodeURIComponent(month)}`, { cache: "no-store" }),
       supabase.from("profiles").select("display_name").eq("id",user.id).maybeSingle(),
       supabase.from("bank_transactions").select("id,amount,booked_at,description,merchant_name,category").eq("user_id",user.id).order("booked_at",{ascending:false}).limit(6),
       supabase.from("transactions").select("id,amount,occurred_at,label,categories(name)").eq("user_id",user.id).order("occurred_at",{ascending:false}).limit(6),
     ]);
     const context = contextResponse.ok ? await contextResponse.json() as UnifiedFinancialContext : null;
     if (context) {
       setFinancialContext(context);
       setRealBalance(Number(context.liquidity.primary_total || 0));
       setRealIncome(Number(context.cashflow.income || 0));
       setFixedExpenses(context.budget.fixed_items.map((x) => ({
         id:x.id,label:x.label,sector:x.sector,amount:Number(x.amount),recurrence:x.recurrence,
         effective_from:month,effective_until:null,is_active:true,
       })));
     }
     if(!profile.error) setDisplayName(profile.data?.display_name ?? "");
     const bankRows = (bankRecent.data ?? []).map((tx:any) => ({ id:`bank:${tx.id}`, label:String(tx.merchant_name || tx.description || "Opération bancaire"), amount:Number(tx.amount || 0), date:String(tx.booked_at || "").slice(0,10), category:String(tx.category || "Opération"), source:"bank" as const }));
     const manualRows = (manualRecent.data ?? []).map((tx:any) => { const rel=Array.isArray(tx.categories)?tx.categories[0]:tx.categories; return { id:`manual:${tx.id}`, label:String(tx.label || "Transaction"), amount:Number(tx.amount || 0), date:String(tx.occurred_at || "").slice(0,10), category:String(rel?.name || "Opération"), source:"manual" as const }; });
     setRecentTransactions([...bankRows,...manualRows].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6));
   } catch {
     setFinancialContext(null);
   }
 },[month]);

 useEffect(()=>{void load();},[load]);

 useEffect(()=>{
   const supabase=getSupabaseBrowserClient(); if(!supabase) return;
   let cancelled=false;
   let channel:any=null;
   let reloadTimer:number|null=null;
   const scheduleLoad=()=>{
     if (reloadTimer !== null) window.clearTimeout(reloadTimer);
     reloadTimer = window.setTimeout(()=>{ reloadTimer=null; void load(); }, 250);
   };
   const setup=async()=>{
     const {data:{user}}=await supabase.auth.getUser();
     if(cancelled || !user) return;
     channel=supabase.channel(`dashboard-live-${user.id}-${crypto.randomUUID()}`);
     channel
       .on("postgres_changes",{event:"*",schema:"public",table:"budget_scenarios",filter:`user_id=eq.${user.id}`},scheduleLoad)
       .on("postgres_changes",{event:"*",schema:"public",table:"fixed_expenses",filter:`user_id=eq.${user.id}`},scheduleLoad)
       .on("postgres_changes",{event:"*",schema:"public",table:"transactions",filter:`user_id=eq.${user.id}`},scheduleLoad)
       .on("postgres_changes",{event:"*",schema:"public",table:"transaction_envelope_links",filter:`user_id=eq.${user.id}`},scheduleLoad)
       .on("postgres_changes",{event:"*",schema:"public",table:"accounts",filter:`user_id=eq.${user.id}`},scheduleLoad)
       .on("postgres_changes",{event:"*",schema:"public",table:"bank_accounts",filter:`user_id=eq.${user.id}`},scheduleLoad)
       .on("postgres_changes",{event:"*",schema:"public",table:"bank_transactions",filter:`user_id=eq.${user.id}`},scheduleLoad)
       .on("postgres_changes",{event:"*",schema:"public",table:"bank_transaction_envelope_links",filter:`user_id=eq.${user.id}`},scheduleLoad);
     if(cancelled){ supabase.removeChannel(channel); channel=null; return; }
     channel.subscribe((status:string)=>{ if(status==="CHANNEL_ERROR") console.warn("[dashboard] Realtime channel error"); });
   };
   void setup();
   return ()=>{ cancelled=true; if (reloadTimer !== null) window.clearTimeout(reloadTimer); if(channel) void supabase.removeChannel(channel); };
 },[load]);

 const fixed = useMemo(()=>fixedExpenses,[fixedExpenses]);
 const fixedTotal=financialContext?.budget.fixed_commitments ?? 0;
 const currentScenario = {
   income: financialContext?.budget.income_planned ?? realIncome,
   starting_balance: financialContext?.budget.starting_balance ?? realBalance,
   safety_reserve: financialContext?.budget.safety_reserve ?? 100,
   extra_expense: financialContext?.budget.extra_expense ?? 0,
   weeks_remaining: financialContext?.budget.weeks_remaining ?? 4,
   envelopes: financialContext?.budget.envelopes ?? [],
 };
 const calculations=useMemo(()=>{
   const variable=Math.max(0, financialContext?.budget.variable_remaining ?? 0);
   const projected=financialContext?.budget.projected_end ?? (currentScenario.starting_balance + currentScenario.income - fixedTotal - variable - currentScenario.extra_expense);
   const reserve=currentScenario.safety_reserve;
   const margin=projected-reserve;
   const weekly=Math.max(margin/Math.max(currentScenario.weeks_remaining,1),0);
   return {variable,projected,margin,weekly};
 },[financialContext,currentScenario.starting_balance,currentScenario.income,currentScenario.safety_reserve,currentScenario.weeks_remaining,fixedTotal]);
 const risk=calculations.projected<0?"high":calculations.margin<100?"medium":"low";
 void supervise({projectedCashflow:calculations.projected,essentialsCovered:calculations.projected>=0,proposedInvestment:0,liquidReserve:realBalance,targetReserve:currentScenario.safety_reserve});

 const runAnalysis = async () => {
   setAnalysisBusy(true); setAnalysisError("");
   try {
     const response=await fetch("/api/lia/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:`Analyse mon budget de ${monthLabel(month)} en tenant compte des charges fixes détaillées, des dépenses variables, du solde réel, des engagements futurs et du scénario simulé.`})});
     const data=await response.json(); if(!response.ok) throw new Error(data.error||"Impossible de lancer l’analyse.");
     void data;
   } catch(e){setAnalysisError(e instanceof Error?e.message:"Erreur inconnue.");}
   finally{setAnalysisBusy(false);}
 };

 const goals = financialContext?.goals ?? [];
 const anomalies = financialContext?.intelligence.anomalies ?? [];
 const recurring = financialContext?.intelligence.recurring ?? [];
 const connected = Math.max(financialContext?.liquidity.connected_bank ?? 0, 0);
 const manual = Math.max(financialContext?.liquidity.manual_accounts ?? 0, 0);
 const liquidTotal = Math.max(connected + manual, 1);
 const connectedPct = Math.round((connected / liquidTotal) * 100);
 const manualPct = 100 - connectedPct;
 const primaryGoal = goals[0];
 const goalProgress = primaryGoal ? Math.min(100, Math.max(0, (primaryGoal.current_amount / Math.max(primaryGoal.target_amount, 1)) * 100)) : 0;
 const netMonth = realIncome - (financialContext?.cashflow.expenses ?? 0);
 const savings = Math.max(netMonth, 0);
 const firstInsight = calculations.projected < 0 ? "Votre projection de fin de mois passe sous zéro." : calculations.margin < 0 ? "Votre marge projetée est sous votre réserve cible." : "Votre trésorerie reste au-dessus de votre réserve cible.";
 const moneyWithSign = (value:number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${money(Math.abs(value))} €`;

 return <main className="dashboard-page nexora-reference-dashboard mx-auto max-w-7xl space-y-5 px-4 pb-24 pt-5 sm:px-6 sm:pb-10 sm:pt-7">
   <div className="dashboard-page-heading"><div><p className="nexora-kicker">Vue d’ensemble</p><h1>Bonjour{displayName ? `, ${displayName}` : ""} 👋</h1><p>Voici un aperçu de votre situation financière aujourd’hui.</p></div><div className="dashboard-date-pill"><CalendarDays className="h-4 w-4"/><span className="capitalize">{monthLabel(month)}</span><ChevronRight className="h-4 w-4"/></div></div>

   <section className="nexora-dashboard-topgrid">
     <Card className="nexora-networth-card"><CardContent className="p-0"><div className="nexora-networth-inner"><div className="nexora-networth-head"><div><p>Valeur totale de vos liquidités</p><span className="nexora-eye"><CircleDollarSign className="h-4 w-4"/> Situation actuelle</span></div><span className="nexora-growth-pill">↗ {realIncome > 0 ? "+" : ""}{realIncome ? Math.round((realIncome / Math.max(realBalance,1))*100) : 0}%</span></div><div className="nexora-networth-value">{money(realBalance)} €</div><div className="nexora-networth-change"><span>{netMonth >= 0 ? "↗" : "↘"} {moneyWithSign(netMonth)}</span><small>ce mois-ci</small></div><div className="flex items-center gap-2 pt-4 text-sm text-muted-foreground"><TrendingUp className="h-4 w-4"/>Le graphique détaillé et interactif est disponible juste dessous.</div></div></CardContent></Card>
     <Card className="nexora-goals-card"><CardHeader><div className="flex items-center justify-between"><CardTitle>Progression vers vos objectifs</CardTitle><Link href="/pilotage" className="nexora-card-link">Voir tout</Link></div></CardHeader><CardContent>{primaryGoal ? <div className="nexora-goal-main"><div className="nexora-donut" style={{"--progress":`${goalProgress}%`} as any}><strong>{Math.round(goalProgress)}%</strong></div><div className="min-w-0"><div className="nexora-goal-icon"><Target className="h-5 w-5"/></div><p className="font-bold">{primaryGoal.name}</p><p className="text-sm text-muted-foreground">{money(primaryGoal.current_amount)} € / {money(primaryGoal.target_amount)} €</p><small>{primaryGoal.target_date ? `Échéance ${new Intl.DateTimeFormat("fr-FR",{month:"long",year:"numeric"}).format(new Date(`${primaryGoal.target_date}T12:00:00`))}` : "Objectif en cours"}</small></div></div> : <div className="nexora-empty-state"><Target className="h-7 w-7"/><p>Aucun objectif configuré</p><Link href="/pilotage">Créer un objectif</Link></div>}{goals.slice(1,3).map((goal)=><div key={goal.name} className="nexora-goal-row"><span className="nexora-goal-mini"><Target className="h-4 w-4"/></span><div className="min-w-0 flex-1"><strong className="block truncate">{goal.name}</strong><small>{money(goal.current_amount)} € / {money(goal.target_amount)} €</small></div><ChevronRight className="h-4 w-4 text-muted-foreground"/></div>)}</CardContent></Card>
   </section>

   <section className="nexora-kpi-grid"><div className="nexora-kpi"><span className="nexora-kpi-icon blue"><Landmark/></span><div><small>Solde disponible</small><strong>{money(realBalance)} €</strong><em>↗ Situation actuelle</em></div></div><div className="nexora-kpi"><span className="nexora-kpi-icon cyan"><ArrowDownRight/></span><div><small>Total des revenus</small><strong>{money(realIncome)} €</strong><em>↗ Ce mois-ci</em></div></div><div className="nexora-kpi"><span className="nexora-kpi-icon red"><ArrowUpRight/></span><div><small>Total des dépenses</small><strong>{money(financialContext?.cashflow.expenses ?? 0)} €</strong><em className="negative">{financialContext?.cashflow.expenses ? "↗ Flux sortants" : "— Aucun flux"}</em></div></div><div className="nexora-kpi"><span className="nexora-kpi-icon green"><PiggyBank/></span><div><small>Épargne ce mois-ci</small><strong>{money(savings)} €</strong><em>↗ Marge disponible</em></div></div><div className="nexora-kpi"><span className="nexora-kpi-icon purple"><TrendingUp/></span><div><small>Projection fin de mois</small><strong>{moneyWithSign(calculations.projected)}</strong><em className={risk === "high" ? "negative" : ""}>{risk === "high" ? "⚠ Vigilance" : "✓ Projection maîtrisée"}</em></div></div></section>

   <BalanceHistoryCard />

   <section className="nexora-dashboard-grid-2"><Card><CardHeader><div className="flex items-center justify-between"><div><CardTitle>Évolution de votre situation</CardTitle><p className="mt-1 text-sm text-muted-foreground">Projection budgétaire du mois.</p></div></div></CardHeader><CardContent><div className="nexora-performance-value">{moneyWithSign(netMonth)} <span>{netMonth >= 0 ? "positif" : "à surveiller"}</span></div><div className="rounded-xl border p-4 text-sm text-muted-foreground">Les soldes bancaires historiques sont affichés dans le graphique interactif ci-dessus. Cette zone reste dédiée à la projection budgétaire.</div></CardContent></Card><Card><CardHeader><div className="flex items-center justify-between"><CardTitle>Répartition de vos comptes</CardTitle><Link href="/banque" className="nexora-card-link">Voir le détail</Link></div></CardHeader><CardContent><div className="nexora-allocation"><div className="nexora-allocation-donut" style={{"--connected":`${connectedPct}%`} as any}><strong>{money(liquidTotal)} €</strong><small>Valeur totale</small></div><div className="nexora-allocation-legend"><div><i className="dot purple"/><span>Comptes connectés</span><b>{connectedPct}%</b></div><div><i className="dot blue"/><span>Comptes manuels</span><b>{manualPct}%</b></div></div></div></CardContent></Card></section>

   <section className="nexora-dashboard-grid-3"><Card><CardHeader><div className="flex items-center justify-between"><CardTitle>À surveiller</CardTitle><Link href="/pilotage" className="nexora-card-link">Voir tout</Link></div></CardHeader><CardContent className="space-y-2.5">{anomalies.slice(0,4).map((item)=><div key={item.id} className="nexora-insight-row"><span className="nexora-insight-icon warning"><AlertTriangle/></span><div><strong>{item.label}</strong><p>{money(item.amount)} € · {item.category}</p></div></div>)}{anomalies.length===0&&<div className="nexora-insight-row"><span className="nexora-insight-icon success"><ShieldCheck/></span><div><strong>Aucune anomalie détectée</strong><p>Les flux observés restent cohérents.</p></div></div>}</CardContent></Card><Card><CardHeader><div className="flex items-center justify-between"><CardTitle>Transactions récentes</CardTitle><Link href="/transactions" className="nexora-card-link">Voir tout</Link></div></CardHeader><CardContent className="space-y-1">{recentTransactions.slice(0,5).map(tx=><div key={tx.id} className="nexora-transaction-row"><span className={`nexora-tx-icon ${tx.amount >= 0 ? "income" : "expense"}`}>{tx.amount >= 0 ? <ArrowDownRight/> : <ArrowUpRight/>}</span><div className="min-w-0 flex-1"><strong className="block truncate">{tx.label}</strong><small>{tx.date ? new Intl.DateTimeFormat("fr-FR",{day:"numeric",month:"short"}).format(new Date(`${tx.date}T12:00:00`)) : ""} · {tx.category}</small></div><b className={tx.amount >= 0 ? "positive" : "negative"}>{moneyWithSign(tx.amount)}</b></div>)}{recentTransactions.length===0&&<p className="py-5 text-sm text-muted-foreground">Aucune transaction récente.</p>}</CardContent></Card><Card><CardHeader><div className="flex items-center justify-between"><CardTitle>Analyses & conseils</CardTitle><Link href="/lia" className="nexora-card-link">Voir tout</Link></div></CardHeader><CardContent className="space-y-2.5"><div className="nexora-insight-row"><span className="nexora-insight-icon success"><TrendingUp/></span><div><strong>{firstInsight}</strong><p>{calculations.projected >= currentScenario.safety_reserve ? "Bonne marge par rapport à votre réserve." : "LIA peut vous aider à ajuster le budget."}</p></div></div><div className="nexora-insight-row"><span className="nexora-insight-icon purple"><Sparkles/></span><div><strong>{recurring.length ? `${recurring.length} flux récurrent(s) identifié(s)` : "Analysez vos flux récurrents"}</strong><p>Utilisez LIA pour détecter les économies possibles.</p></div></div><div className="nexora-insight-row"><span className="nexora-insight-icon blue"><ShieldCheck/></span><div><strong>Votre budget est surveillé</strong><p>{fixed.length} engagement(s) fixe(s) pris en compte.</p></div></div></CardContent></Card></section>

   <section className="nexora-lia-bar"><div className="nexora-lia-avatar"><Sparkles className="h-5 w-5"/></div><div className="min-w-0 flex-1"><strong>LIA, votre assistant financier</strong><p>Posez-moi une question sur vos finances…</p></div><div className="nexora-lia-prompts"><Link href="/lia?q=Où+part+mon+argent+%3F">Où part mon argent ?</Link><Link href="/lia?q=Comment+économiser+%3F">Comment économiser ?</Link><Link href="/lia?q=Analyse+mon+budget">Analyse mon budget</Link><Link href="/lia?q=Mes+objectifs">Mes objectifs</Link></div><Link href="/lia" className="nexora-lia-send" aria-label="Ouvrir LIA"><ArrowRight className="h-5 w-5"/></Link></section>

   <section className="nexora-dashboard-actions"><button type="button" onClick={()=>window.location.href="/transactions?quick=expense"}><Plus/>Ajouter une dépense</button><button type="button" onClick={()=>window.location.href="/budget"}><PiggyBank/>Gérer mon budget</button><button type="button" onClick={runAnalysis} disabled={analysisBusy}><Sparkles/>{analysisBusy ? "Analyse en cours…" : "Analyser avec LIA"}</button>{analysisError&&<span className="text-sm text-red-600 dark:text-red-300">{analysisError}</span>}</section>
 </main>;
}
