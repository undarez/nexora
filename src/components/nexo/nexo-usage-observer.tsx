"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrainCircuit, ChevronRight, ShieldCheck, X } from "lucide-react";
import { getNexoraPageContext } from "@/lib/lia/copilot-context";

const SID="nexora:copilot-session", LAST="nexora:copilot:last-proactive", COOLDOWN=60000;
type Signal={title:string;message:string;page:string};
function sid(){const old=window.sessionStorage.getItem(SID);if(old&&/^[a-zA-Z0-9_-]{16,80}$/.test(old))return old;const id=`nx_${crypto.randomUUID().replaceAll("-","")}`;window.sessionStorage.setItem(SID,id);return id;}
export function NexoUsageObserver(){
 const pathname=usePathname(),[signal,setSignal]=useState<Signal|null>(null),timer=useRef<number|null>(null);
 useEffect(()=>{const ctx=getNexoraPageContext(pathname||"/"),sessionId=sid();let cancelled=false;
  void fetch("/api/lia/activity",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({eventType:"page_view",path:ctx.path,page:ctx.page,sessionId,metadata:{navigation_source:"navigation"}}),keepalive:true}).catch(()=>{});
  if(Date.now()-Number(window.sessionStorage.getItem(LAST)||"0")<COOLDOWN)return()=>{cancelled=true};
  const run=async()=>{window.sessionStorage.setItem(LAST,String(Date.now()));try{const r=await fetch("/api/lia/copilot",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path:ctx.path})});if(!r.ok||cancelled)return;const d=await r.json(),a=typeof d.answer==="string"?d.answer.trim():"";if(!a||a==="NO_PROACTIVE_SIGNAL"||cancelled)return;setSignal({title:"Nexo a une remarque",message:a.slice(0,900),page:ctx.page});timer.current=window.setTimeout(()=>setSignal(null),18000);}catch{}};
  const delay=window.setTimeout(()=>void run(),2200);return()=>{cancelled=true;window.clearTimeout(delay)};
 },[pathname]);
 useEffect(()=>()=>{if(timer.current)window.clearTimeout(timer.current)},[]);
 if(!signal)return null;
 return <aside className="fixed inset-x-3 bottom-[150px] z-[56] sm:left-auto sm:right-6 sm:bottom-28 sm:w-[400px]" aria-live="polite"><div className="overflow-hidden rounded-[1.4rem] border bg-card/95 text-card-foreground shadow-2xl backdrop-blur-xl"><div className="flex items-start gap-3 p-4"><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><BrainCircuit className="h-5 w-5"/></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-sm font-bold">{signal.title}</p><span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{signal.page}</span></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{signal.message}</p><div className="mt-3 flex items-center gap-2"><Link href="#nexo-chat" onClick={()=>setSignal(null)} className="inline-flex min-h-10 flex-1 items-center justify-center gap-1 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground">Dialoguer avec Nexo<ChevronRight className="h-4 w-4"/></Link><button type="button" onClick={()=>setSignal(null)} className="inline-flex min-h-10 items-center gap-1 rounded-xl border px-3 text-xs font-semibold hover:bg-accent"><X className="h-4 w-4"/>Plus tard</button></div><p className="mt-2 flex items-center gap-1 text-[9px] text-muted-foreground"><ShieldCheck className="h-3 w-3"/>Session protégée · aucune donnée DOM envoyée.</p></div></div></div></aside>;
}
