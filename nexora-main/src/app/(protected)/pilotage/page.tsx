"use client";

import { FinancialCrossDomainSummary } from "@/components/finance/financial-cross-domain-summary";
import { useEffect, useMemo, useState } from "react";
import { Bell, Brain, CalendarCheck, CircleDollarSign, Crosshair, Lightbulb, Play, Plus, RefreshCw, Repeat2, ShieldCheck, Sparkles, Target, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { fetchJson } from "@/lib/http/fetch-json";
import type { UnifiedFinancialContext } from "@/lib/finance/unified-financial-context";

const money = (v:number) => new Intl.NumberFormat("fr-FR", {style:"currency",currency:"EUR",maximumFractionDigits:2}).format(v);
const monthKey = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`; };
const norm=(s:string)=>s.toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[\u0300-\u036f]/g,"");

type Tx={id:string;label:string;amount:number;occurred_at:string;categories?:{name:string}|null};
type Goal={id:string;name:string;target_amount:number;current_amount:number;target_date:string|null;priority:number};
type Notification={id:string;title:string;message:string;severity:string;read_at:string|null;action_href:string|null};
type Recurring={id:string;display_label:string;amount:number;cadence:string;occurrences:number;status:string};
type Proposal={id:string;title:string;description:string;risk_class:string;autonomy_level:number;reversible:boolean;status:string;expires_at:string|null};
type FinancialSignal={id:string;severity:"info"|"warning"|"danger";title:string;message:string;actionHref:string;evidence:Record<string,number|string>};
type AutopilotSnapshot={observations:Array<{key:string;severity:string;title:string;message:string;confidence:number}>;opportunities:Array<{key:string;severity:string;title:string;message:string;estimatedImpact:number|null;confidence:number;requiresHumanApproval:boolean}>;predictions:Array<{label:string;amount:number;dueDate:string}>;stats:{transactions:number;envelopes:number;recurringExpenses:number;balance:number;reserve:number}};
type BehaviourProfile={profile:Record<string,unknown>|null;habits:Array<{habit_key:string;label:string;cadence:string;confidence:number;observation:Record<string,unknown>;status?:string}>};

export default function PilotagePage(){
 const [tx,setTx]=useState<Tx[]>([]); const [signals,setSignals]=useState<FinancialSignal[]>([]); const [proposals,setProposals]=useState<Proposal[]>([]); const [autonomy,setAutonomy]=useState(1); const [goals,setGoals]=useState<Goal[]>([]); const [notifications,setNotifications]=useState<Notification[]>([]); const [recurring,setRecurring]=useState<Recurring[]>([]);
 const [income,setIncome]=useState(0); const [expenses,setExpenses]=useState(0); const [autopilot,setAutopilot]=useState<AutopilotSnapshot|null>(null); const [behaviour,setBehaviour]=useState<BehaviourProfile|null>(null); const [balance,setBalance]=useState(0); const [planned,setPlanned]=useState(0); const [spent,setSpent]=useState(0); const [financialContext,setFinancialContext]=useState<UnifiedFinancialContext|null>(null); const [loading,setLoading]=useState(true); const [msg,setMsg]=useState<string|null>(null); const [simPct,setSimPct]=useState("10"); const [goalName,setGoalName]=useState(""); const [goalTarget,setGoalTarget]=useState(""); const [goalCurrent,setGoalCurrent]=useState(""); const [busy,setBusy]=useState(false);
 const period=monthKey();
 async function load(){
  const s=getSupabaseBrowserClient();
  if(!s){setMsg("Supabase non configuré.");setLoading(false);return;} const {data:{user}}=await s.auth.getUser(); if(!user)return; setLoading(true);
  const [watchResult, actionsResult, contextResult, autopilotResult, behaviourResult] = await Promise.allSettled([
   fetch("/api/lia/financial-watch",{cache:"no-store"}),
   fetch("/api/lia/actions",{cache:"no-store"}),
   fetch(`/api/finance/unified-context?month=${encodeURIComponent(period)}`,{cache:"no-store"}),
   fetch("/api/lia/autopilot",{cache:"no-store"}),
   fetch("/api/lia/behaviour",{cache:"no-store"}),
  ]);
  if (contextResult.status === "fulfilled" && contextResult.value.ok) {
   try {
    const context = await contextResult.value.json() as UnifiedFinancialContext;
    setFinancialContext(context);
    setBalance(Number(context.liquidity.primary_total ?? 0));
    setIncome(Number(context.cashflow.income ?? 0));
    setExpenses(Number(context.cashflow.expenses ?? 0));
    setPlanned(Number(context.budget.planned ?? 0));
    setSpent(Number(context.budget.spent ?? 0));
   } catch { setMsg("La vue financière unifiée a renvoyé une réponse invalide."); }
  }
  if (watchResult.status === "fulfilled") {
   try {
    const wd=await watchResult.value.json();
    if(watchResult.value.ok){setSignals(wd.signals??[]);}
   } catch { setMsg("Les indicateurs financiers ont renvoyé une réponse invalide."); }
  }
  if (actionsResult.status === "fulfilled") {
   try {
    const ad=await actionsResult.value.json();
    if(actionsResult.value.ok){setProposals(ad.proposals??[]);setAutonomy(Number(ad.autonomy_level??1));}
   } catch { setMsg("Les propositions d’action ont renvoyé une réponse invalide."); }
  }
  if (autopilotResult.status === "fulfilled") { try { const ad=await autopilotResult.value.json(); if(autopilotResult.value.ok) setAutopilot(ad as AutopilotSnapshot); } catch { setMsg("L’autopilote a renvoyé une réponse invalide."); } }
  if (behaviourResult.status === "fulfilled") { try { const bd=await behaviourResult.value.json(); if(behaviourResult.value.ok) setBehaviour(bd as BehaviourProfile); } catch { setMsg("Le profil comportemental a renvoyé une réponse invalide."); } }
  const start=new Date(); start.setDate(start.getDate()-120);
  let tr, bt, g, n, r;
  try {
    [tr,bt,g,n,r]=await Promise.all([
   s.from("transactions").select("id,label,amount,occurred_at,categories(name)").eq("user_id",user.id).gte("occurred_at",start.toISOString()).order("occurred_at",{ascending:false}).limit(500),
   s.from("bank_transactions").select("id,description,merchant_name,amount,booked_at,category").eq("user_id",user.id).gte("booked_at",start.toISOString().slice(0,10)).order("booked_at",{ascending:false}).limit(500),
   s.from("goals").select("id,name,target_amount,current_amount,target_date,priority").eq("user_id",user.id).order("priority"),
   s.from("notifications").select("id,title,message,severity,read_at,action_href").eq("user_id",user.id).order("created_at",{ascending:false}).limit(12),
   s.from("recurring_patterns").select("id,display_label,amount,cadence,occurrences,status").eq("user_id",user.id).neq("status","dismissed").order("updated_at",{ascending:false}).limit(12)
  ]);
  } catch (error) {
    setMsg(error instanceof Error ? error.message : "Impossible de charger les données financières.");
    setLoading(false);
    return;
  }
  const first=[tr,bt,g,n,r].find(x=>x.error); if(first?.error){setMsg(first.error.message);setLoading(false);return;}
  const rows: Tx[] = (tr.data ?? []).map((row) => {
   const category = Array.isArray(row.categories)
    ? row.categories[0] ?? null
    : row.categories ?? null;

   return {
    id: row.id,
    label: row.label,
    amount: Number(row.amount),
    occurred_at: row.occurred_at,
    categories: category ? { name: String(category.name) } : null,
   };
  });
  const bankRows: Tx[] = (bt.data ?? []).map((row) => ({
   id: `bank:${row.id}`,
   label: String(row.merchant_name || row.description || "Opération bancaire"),
   amount: Number(row.amount),
   occurred_at: String(row.booked_at),
   categories: row.category ? { name: String(row.category) } : null,
  }));

  setTx([...rows, ...bankRows].sort((a,b)=>String(b.occurred_at).localeCompare(String(a.occurred_at))));
  setGoals((g.data ?? []) as Goal[]);
  setNotifications((n.data ?? []) as Notification[]);
  setRecurring((r.data ?? []) as Recurring[]);
  setLoading(false);
 }
 useEffect(()=>{void load();},[]);
 const net=income-expenses; const elapsed=Math.min(new Date().getDate()/new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate(),1); const pace=planned>0?spent/planned:0; const score=Math.max(0,Math.min(100,Math.round(50+(net>=0?20:0)+(planned>0&&pace<=Math.min(elapsed+0.1,1)?15:0)+(goals.length?10:0)+(notifications.filter(n=>!n.read_at&&n.severity==="danger").length?0:5))));
 const recurringCandidates=useMemo(()=>{ const m=new Map<string,Tx[]>(); tx.filter(x=>x.amount<0).forEach(x=>{const k=`${norm(x.label)}|${Math.round(Math.abs(x.amount)*100)}`;m.set(k,[...(m.get(k)||[]),x]);});return [...m.values()].filter(x=>x.length>=2).slice(0,5);},[tx]);
 async function setAutonomyLevel(level:number){ const s=getSupabaseBrowserClient(); if(!s)return; setBusy(true); try { const {error}=await s.rpc("set_lia_autonomy",{p_user_id:(await s.auth.getUser()).data.user?.id,p_level:level}); setMsg(error?error.message:`✓ Autonomie LIA réglée sur ${level}/8.`); if(!error)setAutonomy(level); } catch (error) { setMsg(error instanceof Error ? error.message : "Impossible de modifier l’autonomie."); } finally { setBusy(false); } }
 async function decideProposal(id:string,decision:"approved"|"rejected"){setBusy(true);try{await fetchJson<{message?:string}>("/api/lia/actions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id,decision})});setMsg(`✓ Proposition ${decision==="approved"?"approuvée":"refusée"}.`);await load();}catch(error){setMsg(error instanceof Error?error.message:"Décision impossible. Réessayez.");}finally{setBusy(false);}}
 async function classifyReliableTransactions(){ setBusy(true); setMsg(null); try { const r=await fetch("/api/lia/autopilot",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:"classify"})}); const d=await r.json(); if(!r.ok) throw new Error(d.error||"Classification indisponible."); setMsg(`✓ ${d.applied??0} transaction(s) classée(s).`); await load(); } catch(error){ setMsg(error instanceof Error?error.message:"Classification impossible."); } finally { setBusy(false); } }
 async function learnBehaviour(){ setBusy(true); setMsg(null); try { const r=await fetch("/api/lia/behaviour",{method:"POST"}); const d=await r.json(); if(!r.ok) throw new Error(d.error||"Apprentissage indisponible."); setMsg(`✓ ${d.habits?.filter((h:{status?:string})=>h.status==="accepted").length??0} habitude(s) fiable(s) détectée(s).`); await load(); } catch(error){ setMsg(error instanceof Error?error.message:"Apprentissage impossible."); } finally { setBusy(false); } }
 async function executeProposal(id: string) {
  setBusy(true);

  try {
    await fetchJson("/api/lia/actions/execute", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ id }),
    });

    setMsg("✓ Action exécutée et auditée.");
    await load();
  } catch (error) {
    setMsg(
      error instanceof Error
        ? error.message
        : "Exécution impossible. Réessayez."
    );
  } finally {
    setBusy(false);
  }
}
 async function saveGoal() {
  const s = getSupabaseBrowserClient();
  if (!s) return;

  const { data: { user } } = await s.auth.getUser();
  if (!user || !goalName || !Number(goalTarget)) return;

  setBusy(true);
  const { error } = await s.from("goals").insert({
   user_id: user.id,
   name: goalName,
   target_amount: Number(goalTarget),
   current_amount: Number(goalCurrent || 0),
   priority: 50,
  });
  setBusy(false);
  setMsg(error ? error.message : "✓ Objectif ajouté.");

  if (!error) {
   setGoalName("");
   setGoalTarget("");
   setGoalCurrent("");
   await load();
  }
 }

 async function closeMonth() {
  const s = getSupabaseBrowserClient();
  if (!s) return;

  const { data: { user } } = await s.auth.getUser();
  if (!user) return;

  setBusy(true);
  const adherence = planned > 0
   ? Math.max(0, Math.min(100, (1 - spent / planned) * 100))
   : null;

  const { error } = await s.from("monthly_closures").upsert({
   user_id: user.id,
   period_start: period,
   income,
   expenses,
   net,
   budget_adherence: adherence,
   notes: "Clôture préparée depuis le centre de pilotage.",
   prepared_next_period: false,
  }, { onConflict: "user_id,period_start" });

  setBusy(false);
  setMsg(error ? error.message : "✓ Mois clôturé. Le récapitulatif est conservé.");
 }

 async function learn() {
  const s = getSupabaseBrowserClient();
  if (!s) return;

  const { data: { user } } = await s.auth.getUser();
  if (!user) return;

  setBusy(true);
  const observations = [
   {
    memory_type: "observation",
    topic: "monthly_net",
    before_value: null,
    after_value: { income, expenses, net },
    evidence: { period, source: "transactions" },
    confidence: 99,
    status: "accepted",
   },
   {
    memory_type: "observation",
    topic: "budget_pace",
    before_value: null,
    after_value: { planned, spent, elapsed },
    evidence: { period, source: "budget_scenarios" },
    confidence: 95,
    status: "accepted",
   },
  ];

  const { error } = await s
   .from("ai_learning_memory")
   .insert(observations.map((x) => ({ ...x, user_id: user.id })));

  setBusy(false);
  setMsg(error
   ? error.message
   : "✓ Observation enregistrée dans la mémoire d'apprentissage.");
 }

 async function action(question:string){setBusy(true);try{const r=await fetch("/api/lia/chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({question,task:"financial_analysis"})});const d=await r.json();setMsg(r.ok?(d.analysis||"Analyse terminée."):(d.error||"Analyse indisponible."));}finally{setBusy(false);}}
 const simulated=expenses*(1+Number(simPct||0)/100); const simNet=income-simulated;
 return <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
  <FinancialCrossDomainSummary context={financialContext} />
  <div id="autopilot" className="grid gap-6 lg:grid-cols-2 scroll-mt-24">
   <Card><CardHeader><CardTitle>Autopilote financier intégré</CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid grid-cols-2 gap-2"><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Transactions observées</p><p className="text-xl font-bold">{autopilot?.stats.transactions??0}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Opportunités / risques</p><p className="text-xl font-bold">{autopilot?.opportunities.length??0}</p></div></div><div className="space-y-2">{(autopilot?.opportunities??[]).slice(0,3).map(o=><div key={o.key} className="rounded-lg border p-3"><p className="font-semibold">{o.title}</p><p className="text-sm text-muted-foreground">{o.message}</p></div>)}{!autopilot?.opportunities.length&&<p className="text-sm text-muted-foreground">Aucune opportunité prioritaire.</p>}</div><Button variant="outline" onClick={()=>void classifyReliableTransactions()} disabled={busy}>Classer les transactions fiables</Button></CardContent></Card>
   <Card id="habitudes"><CardHeader><CardTitle>Habitudes financières intégrées</CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid grid-cols-2 gap-2"><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Régularités apprises</p><p className="text-xl font-bold">{behaviour?.habits.length??0}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Confiance profil</p><p className="text-xl font-bold">{Math.round(Number(behaviour?.profile?.confidence??0)*100)} %</p></div></div><div className="space-y-2">{(behaviour?.habits??[]).slice(0,3).map(h=><div key={h.habit_key} className="rounded-lg border p-3"><div className="flex items-center justify-between"><p className="font-semibold">{h.label}</p><span className="text-xs text-muted-foreground">{Math.round(h.confidence*100)} %</span></div><p className="text-sm text-muted-foreground">{h.cadence}</p></div>)}{!behaviour?.habits.length&&<p className="text-sm text-muted-foreground">Pas encore assez d’historique.</p>}</div><Button variant="outline" onClick={()=>void learnBehaviour()} disabled={busy}>Analyser les habitudes</Button></CardContent></Card>
  </div>
  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Pilotage</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Tout ce qu'il faut pour agir</h1><p className="mt-2 max-w-2xl text-muted-foreground">Un centre unique pour comprendre, simuler, apprendre et agir. Les calculs financiers restent déterministes ; LIA explique et propose.</p></div><Button variant="outline" onClick={()=>void load()}><RefreshCw className="mr-2 h-4 w-4"/>Actualiser</Button></div>
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Solde</p><p className="mt-2 text-2xl font-bold">{money(balance)}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Net du mois</p><p className={`mt-2 text-2xl font-bold ${net>=0?"text-[var(--success)]":"text-red-600"}`}>{money(net)}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Budget consommé</p><p className="mt-2 text-2xl font-bold">{planned?Math.round(pace*100):0}%</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Score pédagogique</p><p className="mt-2 text-2xl font-bold">{score}/100</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">À traiter</p><p className="mt-2 text-2xl font-bold">{notifications.filter(n=>!n.read_at).length}</p></CardContent></Card></div>
  <Card><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary"/>Actions en 1 clic</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-3"><Button onClick={()=>window.location.href="/transactions?quick=expense"}><Plus className="mr-2 h-4 w-4"/>Ajouter une dépense</Button><Button variant="outline" onClick={()=>window.location.href="/transactions?quick=income"}><CircleDollarSign className="mr-2 h-4 w-4"/>Ajouter un revenu</Button><Button variant="outline" onClick={()=>window.location.href="/budget"}>Ajouter à une enveloppe</Button><Button variant="outline" onClick={()=>void action("Analyse mon mois et donne-moi les trois actions les plus utiles, sans modifier aucune donnée.")} disabled={busy}><Brain className="mr-2 h-4 w-4"/>Analyser mon mois</Button><Button variant="outline" onClick={()=>void action("Cherche les dépenses inhabituelles ou les dérives dans mes données récentes et explique les preuves.")} disabled={busy}>Trouver les anomalies</Button></CardContent></Card>
  {signals.length>0&&<Card className="border-primary/20"><CardHeader><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary"/>Surveillance financière</CardTitle><Button size="sm" variant="outline" onClick={async()=>{setBusy(true);try{const r=await fetch("/api/lia/proactive/loop",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({signal_id:signals[0]?.id})});const d=await r.json();setMsg(r.ok?"✓ Boucle proactive exécutée : analyse et proposition préparées.":(d.error||"Boucle proactive indisponible."));await load();} catch (error) { setMsg(error instanceof Error ? error.message : "Décision impossible. Réessayez."); } finally {setBusy(false);}}} disabled={busy}>Lancer la boucle LIA</Button></div></CardHeader><CardContent className="space-y-3">{signals.map(x=><div key={x.id} className="rounded-xl border p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{x.title}</p><p className="mt-1 text-sm text-muted-foreground">{x.message}</p></div><span className="rounded-full border px-2 py-1 text-[10px] font-bold uppercase">{x.severity}</span></div><Button className="mt-3" size="sm" variant="outline" onClick={()=>window.location.href=x.actionHref}>Examiner</Button></div>)}</CardContent></Card>}
  <div className="grid gap-6 lg:grid-cols-2">
   <Card><CardHeader><CardTitle className="flex items-center gap-2"><Repeat2 className="h-5 w-5 text-primary"/>Récurrences</CardTitle></CardHeader><CardContent className="space-y-3">{recurring.length?recurring.map(r=><div key={r.id} className="flex items-center justify-between rounded-lg border p-3"><div><p className="font-semibold">{r.display_label}</p><p className="text-xs text-muted-foreground">{r.cadence} · {r.occurrences} observations · {r.status}</p></div><span className="font-bold">{money(r.amount)}</span></div>):recurringCandidates.map(r=><div key={r[0].id} className="rounded-lg border p-3"><p className="font-semibold">{r[0].label}</p><p className="text-xs text-muted-foreground">{r.length} occurrences détectées · {money(Math.abs(r[0].amount))}</p></div>)}{!recurring.length&&!recurringCandidates.length&&<p className="text-sm text-muted-foreground">Pas encore assez d'historique.</p>}</CardContent></Card>
   <Card><CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary"/>Centre d'alertes</CardTitle></CardHeader><CardContent className="space-y-3">{notifications.slice(0,6).map(n=><div key={n.id} className={`rounded-lg border p-3 ${!n.read_at?"bg-muted/40":""}`}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{n.title}</p><p className="text-sm text-muted-foreground">{n.message}</p></div>{n.action_href&&<Button variant="outline" size="sm" onClick={()=>window.location.href=n.action_href!}>Ouvrir</Button>}</div></div>)}{!notifications.length&&<p className="text-sm text-muted-foreground">Aucune alerte.</p>}</CardContent></Card>
  </div>
  <div className="grid gap-6 lg:grid-cols-3">
   <Card><CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary"/>Objectifs</CardTitle></CardHeader><CardContent className="space-y-4">{goals.slice(0,4).map(g=>{const p=Math.max(0,Math.min(100,g.target_amount?g.current_amount/g.target_amount*100:0));return <div key={g.id}><div className="flex justify-between text-sm"><span className="font-semibold">{g.name}</span><span>{Math.round(p)}%</span></div><div className="mt-2 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{width:`${p}%`}}/></div><p className="mt-1 text-xs text-muted-foreground">{money(g.current_amount)} / {money(g.target_amount)}</p></div>})}<div className="grid gap-2"><Input placeholder="Nom" value={goalName} onChange={e=>setGoalName(e.target.value)}/><div className="grid grid-cols-2 gap-2"><Input inputMode="decimal" placeholder="Objectif €" value={goalTarget} onChange={e=>setGoalTarget(e.target.value)}/><Input inputMode="decimal" placeholder="Actuel €" value={goalCurrent} onChange={e=>setGoalCurrent(e.target.value)}/></div><Button onClick={()=>void saveGoal()} disabled={busy||!goalName||!goalTarget}><Plus className="mr-2 h-4 w-4"/>Créer l'objectif</Button></div></CardContent></Card>
   <Card><CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary"/>Simulateur « Et si… ? »</CardTitle></CardHeader><CardContent className="space-y-4"><label className="text-sm">Hausse des dépenses (%)<Input className="mt-2" inputMode="decimal" value={simPct} onChange={e=>setSimPct(e.target.value)}/></label><div className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Net actuel</p><p className="text-xl font-bold">{money(net)}</p><p className="mt-3 text-xs text-muted-foreground">Net simulé</p><p className={`text-xl font-bold ${simNet>=0?"text-[var(--success)]":"text-red-600"}`}>{money(simNet)}</p><p className="mt-2 text-xs text-muted-foreground">Simulation isolée : aucune donnée réelle n'est modifiée.</p></div></CardContent></Card>
   <Card><CardHeader><CardTitle className="flex items-center gap-2"><CalendarCheck className="h-5 w-5 text-primary"/>Clôture & apprentissage</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Le mois est résumé à partir des faits observés. La mémoire apprend uniquement ce qui est explicitement enregistré.</p><Button className="w-full" onClick={()=>void closeMonth()} disabled={busy}><CalendarCheck className="mr-2 h-4 w-4"/>Clôturer le mois</Button><Button variant="outline" className="w-full" onClick={()=>void learn()} disabled={busy}><Lightbulb className="mr-2 h-4 w-4"/>Apprendre de l'observation</Button><Button variant="outline" className="w-full" onClick={()=>void action("Prépare mon prochain mois à partir des tendances observées. Donne seulement des propositions à valider.")} disabled={busy}><Play className="mr-2 h-4 w-4"/>Préparer le prochain mois</Button></CardContent></Card>
  </div>
  <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary"/>Autonomie & autorisations LIA</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap gap-2">{[0,1,2,3,4,5,6,7,8].map(level=><Button key={level} size="sm" variant={autonomy===level?"default":"outline"} onClick={()=>void setAutonomyLevel(level)} disabled={busy}>L{level}</Button>)}</div><p className="text-sm text-muted-foreground">Niveau actif : <strong>{autonomy}/8</strong>. Le plafond est appliqué côté Supabase ; le modèle ne peut pas l’augmenter.</p>{proposals.length>0&&<div className="space-y-3">{proposals.map(p=><div key={p.id} className="rounded-xl border p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-semibold">{p.title}</p><p className="mt-1 text-sm text-muted-foreground">{p.description}</p><p className="mt-2 text-xs text-muted-foreground">Risque : {p.risk_class} · L{p.autonomy_level} · {p.reversible?"réversible":"non réversible"}</p></div><div className="flex shrink-0 gap-2">{p.status==="proposed"&&<><Button size="sm" onClick={()=>void decideProposal(p.id,"approved")} disabled={busy}>Approuver</Button><Button size="sm" variant="outline" onClick={()=>void decideProposal(p.id,"rejected")} disabled={busy}>Refuser</Button></>}{p.status==="approved"&&<Button size="sm" onClick={()=>void executeProposal(p.id)} disabled={busy}>Exécuter</Button>}</div></div></div>)}</div>}</CardContent></Card>
  <Card><CardHeader><CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-primary"/>LIA · Cognitive Core</CardTitle></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border bg-muted/30 p-4"><p className="text-xs text-muted-foreground">Mode</p><p className="mt-1 font-semibold">Proposition supervisée</p></div><div className="rounded-xl border bg-muted/30 p-4"><p className="text-xs text-muted-foreground">Boucle</p><p className="mt-1 font-semibold">Observer → vérifier → apprendre</p></div><div className="rounded-xl border bg-muted/30 p-4"><p className="text-xs text-muted-foreground">Sécurité</p><p className="mt-1 font-semibold text-[var(--success)]">Garde-fous actifs</p></div></div><p className="mt-4 text-sm text-muted-foreground">LIA peut observer, critiquer et proposer. Les actions financières sensibles restent soumises à une autorisation déterministe.</p></CardContent></Card>
  <Card id="faire-le-point"><CardHeader><CardTitle className="flex items-center gap-2"><Crosshair className="h-5 w-5 text-primary"/>Faire le point</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">Une synthèse unique de budget, transactions, prévisions, objectifs, alertes et score. Le moteur cognitif intégré peut répondre sans dépendance à un fournisseur externe ; un fournisseur génératif n'est qu'un enrichissement optionnel.</p><Button className="mt-4" onClick={()=>void action("Fais le point complet sur ma situation financière : faits observés, points positifs, risques, objectifs, budget, prévisions et trois propositions prioritaires. N'exécute aucune action.")} disabled={busy}><Sparkles className="mr-2 h-4 w-4"/>Faire le point maintenant</Button>{msg&&<div className="mt-4 whitespace-pre-wrap rounded-xl border bg-muted/30 p-4 text-sm">{msg}</div>}</CardContent></Card>
  {loading&&<p className="text-sm text-muted-foreground">Chargement…</p>}
 </main>
}
