"use client";

import { useEffect, useState } from "react";
import { BrainCircuit, MessageCircle, ShieldCheck, Target, TrendingUp, AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Message={role:"user"|"assistant";content:string};
type Copilot={financial:{available:boolean;balance:number;income90d:number;expense90d:number;transactionCount:number;net90d:number};planning:{budgetAvailable:boolean;goalsCount:number;forecastCount:number};recommendation:{title:string;priority:string;confidence:string;confidenceScore:number;recommendation:string;risks:string[]};governance:{readOnlyContext:boolean;recommendationIsNotAction:boolean;humanApprovalRequired:boolean}};

export default function LiaPage(){
  const [question,setQuestion]=useState("");
  const [messages,setMessages]=useState<Message[]>([]);
  const [busy,setBusy]=useState(false);
  const [model,setModel]=useState<string|null>(null);
  const [error,setError]=useState("");
  const [copilot,setCopilot]=useState<Copilot|null>(null);
  const [copilotBusy,setCopilotBusy]=useState(true);

  useEffect(()=>{try{const raw=localStorage.getItem("nexora.lia.history");if(raw)setMessages(JSON.parse(raw).slice(-12));}catch{};
    void fetch("/api/lia/copilot",{cache:"no-store"}).then(async r=>{if(!r.ok)throw new Error("copilot"); const d=await r.json(); setCopilot(d.copilot||null);}).catch(()=>{}).finally(()=>setCopilotBusy(false));
  },[]);
  useEffect(()=>{try{localStorage.setItem("nexora.lia.history",JSON.stringify(messages.slice(-12)));}catch{}},[messages]);

  async function ask(text=question){
    const value=text.trim().slice(0,4000); if(!value||busy)return;
    const next=[...messages,{role:"user" as const,content:value}]; setMessages(next); setQuestion(""); setBusy(true); setError("");
    try{
      const r=await fetch("/api/lia/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:value,task:"financial_analysis",history:next.slice(-8)})});
      const d=await r.json(); if(!r.ok)throw new Error(d.error||"LIA indisponible.");
      setModel(d.model||null);
      setMessages(prev=>[...prev,{role:"assistant" as const,content:String(d.analysis||"Analyse terminée.")}].slice(-12));
    }catch(e){setError(e instanceof Error?e.message:"LIA indisponible.");}
    finally{setBusy(false);}
  }

  return <div className="mx-auto w-full max-w-6xl space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm font-semibold text-muted-foreground">NEXORA · LIA</p><h1 className="text-3xl font-bold tracking-tight">Votre intelligence financière</h1><p className="mt-1 text-muted-foreground">Un espace dédié pour dialoguer avec LIA à partir de votre contexte financier et de vos objectifs.</p></div>
      <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-2 text-sm"><span className="h-2 w-2 rounded-full bg-emerald-500"/>LIA active</div>
    </div>

    {!copilotBusy && copilot && <Card className="border-primary/20 bg-primary/[0.03]"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5"/>Copilote financier</CardTitle><p className="text-sm text-muted-foreground">Une vue unifiée de la situation, de la planification et de la prochaine recommandation.</p></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Solde",`${copilot.financial.balance.toFixed(2)} €`],["Flux net 90 j",`${copilot.financial.net90d.toFixed(2)} €`],["Transactions",String(copilot.financial.transactionCount)],["Objectifs",String(copilot.planning.goalsCount)]].map(([label,value])=><div key={label} className="rounded-xl border bg-card p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-bold">{value}</p></div>)}</div><div className="rounded-xl border bg-card p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommandation actuelle</p><h2 className="mt-1 font-bold">{copilot.recommendation.title}</h2></div><span className="rounded-full border px-2.5 py-1 text-xs font-bold">{copilot.recommendation.priority} · {Math.round(copilot.recommendation.confidenceScore*100)} %</span></div><p className="mt-3 text-sm leading-6">{copilot.recommendation.recommendation}</p>{copilot.recommendation.risks?.length>0&&<div className="mt-3 flex items-start gap-2 rounded-lg border p-2.5 text-xs text-muted-foreground"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/> {copilot.recommendation.risks[0]}</div>}<div className="mt-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground"><CheckCircle2 className="h-4 w-4"/> Lecture seule · recommandation ≠ action · validation humaine requise</div></div></CardContent></Card>}

    <div className="grid gap-4 md:grid-cols-4">
      {[{i:BrainCircuit,t:"Raisonnement",d:"Analyse structurée"},{i:TrendingUp,t:"Finance",d:"Budget et flux"},{i:Target,t:"Objectifs",d:"Priorités personnelles"},{i:ShieldCheck,t:"Gouvernance",d:"Actions protégées"}].map(({i:Icon,t,d})=><Card key={t}><CardContent className="pt-5"><Icon className="mb-3 h-5 w-5"/><p className="font-semibold">{t}</p><p className="text-sm text-muted-foreground">{d}</p></CardContent></Card>)}
    </div>

    <Card className="overflow-hidden"><CardHeader><CardTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5"/>Parler à LIA</CardTitle><p className="text-sm text-muted-foreground">LIA raisonne avec les données autorisées. Les décisions sensibles restent soumises aux garde-fous de NEXORA.</p></CardHeader>
      <CardContent className="space-y-4">
        <div className="min-h-[360px] space-y-3 rounded-xl border bg-muted/20 p-4">
          {!messages.length&&<div className="flex h-[320px] flex-col items-center justify-center text-center"><BrainCircuit className="mb-4 h-10 w-10"/><h2 className="text-xl font-semibold">Que voulez-vous comprendre ?</h2><p className="mt-2 max-w-lg text-sm text-muted-foreground">Demandez-moi de faire le point sur votre budget, vos dépenses, votre trésorerie ou vos objectifs.</p><div className="mt-5 flex flex-wrap justify-center gap-2">{["Fais-moi le point sur mes finances","Quelles sont mes priorités ?","Où puis-je réduire mes dépenses ?"].map(q=><Button key={q} variant="outline" onClick={()=>void ask(q)}>{q}</Button>)}</div></div>}
          {messages.map((m,i)=><div key={i} className={m.role==="user"?"ml-auto max-w-[85%] rounded-2xl bg-primary px-4 py-3 text-primary-foreground":"max-w-[90%] rounded-2xl border bg-card px-4 py-3"}><p className="whitespace-pre-wrap text-sm leading-6">{m.content}</p></div>)}
          {busy&&<div className="max-w-[90%] rounded-2xl border bg-card px-4 py-3 text-sm text-muted-foreground">LIA raisonne…</div>}
        </div>
        {error&&<div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">{error}</div>}
        <form onSubmit={e=>{e.preventDefault();void ask()}} className="flex gap-2"><textarea value={question} onChange={e=>setQuestion(e.target.value)} disabled={busy} placeholder="Écrivez votre question à LIA…" rows={2} className="min-h-12 flex-1 resize-none rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"/><Button type="submit" disabled={busy||!question.trim()} className="self-end">Envoyer</Button></form>
        {model&&<p className="text-xs text-muted-foreground">Moteur linguistique : {model} · Le moteur n'est pas l'autorité financière.</p>}
      </CardContent>
    </Card>
  </div>;
}
