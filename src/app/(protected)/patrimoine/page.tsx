"use client";

import { FinancialCrossDomainSummary } from "@/components/finance/financial-cross-domain-summary";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, TrendingUp, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type Wealth = { id:string; name:string; asset_type:string; value:number; valuation_date:string; notes:string|null };
const types = [["cash","Liquidités"],["savings","Épargne"],["investment","Investissements"],["real_estate","Immobilier"],["crypto","Crypto"],["vehicle","Véhicule"],["other","Autre"]];

function LineChart({points}:{points:number[]}) {
  const max=Math.max(...points,1), min=Math.min(...points,0), range=Math.max(max-min,1);
  const d=points.map((v,i)=>`${i*(100/(Math.max(points.length-1,1)))},${100-((v-min)/range)*90-5}`).join(" ");
  return <svg viewBox="0 0 100 100" className="h-48 w-full overflow-visible"><polyline fill="none" stroke="currentColor" strokeWidth="2" points={d}/>{points.map((v,i)=><circle key={i} cx={i*(100/(Math.max(points.length-1,1)))} cy={100-((v-min)/range)*90-5} r="1.5" fill="currentColor"/>)}</svg>;
}

export default function Page(){
  const [items,setItems]=useState<Wealth[]>([]); const [name,setName]=useState(""); const [type,setType]=useState("savings"); const [value,setValue]=useState(""); const [busy,setBusy]=useState(false);
  const load=async()=>{const s=getSupabaseBrowserClient(); if(!s)return; const {data}=await s.from("wealth_entries").select("id,name,asset_type,value,valuation_date,notes").order("valuation_date",{ascending:true}); setItems((data??[]) as Wealth[])};
  useEffect(()=>{void load(); const s=getSupabaseBrowserClient(); if(!s)return; const c=s.channel("wealth-realtime").on("postgres_changes",{event:"*",schema:"public",table:"wealth_entries"},()=>void load()).subscribe(); return()=>{void s.removeChannel(c)}},[]);
  const total=useMemo(()=>items.reduce((a,x)=>a+Number(x.value),0),[items]);
  const byType=useMemo(()=>types.map(([k,l])=>({k,l,v:items.filter(x=>x.asset_type===k).reduce((a,x)=>a+Number(x.value),0)})).filter(x=>x.v!==0),[items]);
  const add=async()=>{const s=getSupabaseBrowserClient(); if(!s||!name.trim()||!value)return; setBusy(true); const {data:{user}}=await s.auth.getUser(); if(user) await s.from("wealth_entries").insert({user_id:user.id,name:name.trim(),asset_type:type,value:Number(value),valuation_date:new Date().toISOString().slice(0,10)}); setName("");setValue("");setBusy(false);void load()};
  const remove=async(id:string)=>{const s=getSupabaseBrowserClient(); if(!s)return; await s.from("wealth_entries").delete().eq("id",id);void load()};
  const history=items.map(x=>Number(x.value));
  return <main className="app-surface-page mx-auto max-w-7xl space-y-6 px-4 py-6 pb-24 sm:px-6 sm:py-8">
  <FinancialCrossDomainSummary />
    <div className="app-page-hero"><p className="app-page-kicker">Patrimoine vivant</p><h1 className="app-page-title">Mon patrimoine</h1><p className="mt-2 text-sm text-muted-foreground">Ajoute ou corrige tes actifs manuellement maintenant. Les futures connexions bancaires pourront alimenter automatiquement cette vue.</p></div>
    <div className="mobile-rail grid gap-4 md:grid-cols-3"><Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Patrimoine déclaré</p><p className="financial-number mt-2 text-3xl font-bold">{total.toLocaleString("fr-FR",{style:"currency",currency:"EUR"})}</p><p className="mt-1 text-xs text-muted-foreground">Actualisé en temps réel</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Actifs suivis</p><p className="mt-2 text-3xl font-bold">{items.length}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Lecture</p><p className="mt-2 text-sm">Le patrimoine n'est pas assimilé à ta trésorerie disponible.</p></CardContent></Card></div>
    <div className="grid gap-6 lg:grid-cols-[1.4fr_.8fr]"><Card><CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary"/>Évolution des valeurs saisies</CardTitle></CardHeader><CardContent>{history.length>1?<LineChart points={history}/>:<div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Ajoute plusieurs valorisations pour afficher une courbe d'évolution.</div>}</CardContent></Card><Card><CardHeader><CardTitle>Répartition</CardTitle></CardHeader><CardContent className="space-y-3">{byType.length?byType.map((x,i)=><div key={`${x.k || "type"}-${i}`}><div className="flex justify-between text-sm"><span>{x.l}</span><b>{x.v.toLocaleString("fr-FR",{style:"currency",currency:"EUR"})}</b></div><div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{width:`${Math.min(100,total?x.v/total*100:0)}%`}}/></div></div>):<p className="text-sm text-muted-foreground">Aucun actif saisi.</p>}</CardContent></Card></div>
    <Card><CardHeader><CardTitle>Ajouter ou actualiser un actif</CardTitle></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-4"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Ex. Livret A" className="rounded-xl border bg-background px-3 py-2"/><select value={type} onChange={e=>setType(e.target.value)} className="rounded-xl border bg-background px-3 py-2">{types.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select><input value={value} onChange={e=>setValue(e.target.value)} type="number" step="0.01" placeholder="Valeur (€)" className="rounded-xl border bg-background px-3 py-2"/><Button onClick={()=>void add()} disabled={busy||!name||!value}><Plus className="mr-2 h-4 w-4"/>Ajouter</Button></div></CardContent></Card>
    <Card><CardHeader><CardTitle>Actifs suivis</CardTitle></CardHeader><CardContent className="space-y-2">{items.length?items.slice().reverse().map(x=><div key={x.id} className="flex items-center justify-between rounded-xl border p-3"><div><p className="font-medium">{x.name}</p><p className="text-xs text-muted-foreground">{types.find(t=>t[0]===x.asset_type)?.[1]} · {new Date(x.valuation_date).toLocaleDateString("fr-FR")}</p></div><div className="flex items-center gap-3"><b>{Number(x.value).toLocaleString("fr-FR",{style:"currency",currency:"EUR"})}</b><Button variant="ghost" onClick={()=>void remove(x.id)} aria-label="Supprimer"><Trash2 className="h-4 w-4"/></Button></div></div>):<p className="text-sm text-muted-foreground">Commence par ajouter un actif ou connecte une banque lorsque le connecteur sera activé.</p>}<Button variant="outline" onClick={()=>void load()}><RefreshCw className="mr-2 h-4 w-4"/>Actualiser</Button></CardContent></Card>
  </main>
}
