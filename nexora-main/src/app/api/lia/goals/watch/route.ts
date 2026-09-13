import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { detectGoalSignals } from "@/lib/finance/goal-watch";
import { assertSameOrigin } from "@/lib/security/csrf";
import { runProactiveFinancialLoop } from "@/lib/lia/proactive/loop";

function admin() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL; const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key) throw new Error("Supabase server secret missing.");
  return createAdminClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
}
async function context(){ const s=await createClient(); if(!s)return {s:null,user:null,error:"Supabase non configuré."}; const {data:{user}}=await s.auth.getUser(); if(!user)return {s,user:null,error:"Session requise."}; const {data,error}=await s.from("goals").select("id,name,target_amount,current_amount,target_date,priority").eq("user_id",user.id).order("priority").limit(50); if(error)return {s,user,error:"Objectifs indisponibles."}; return {s,user,goals:data??[],error:null}; }
export async function GET(){ const c=await context(); if(c.error)return NextResponse.json({error:c.error},{status:c.error==="Session requise."?401:503}); return NextResponse.json({signals:detectGoalSignals(c.goals??[]),generatedAt:new Date().toISOString()}); }
export async function POST(req:Request){ try{assertSameOrigin(req);}catch{return NextResponse.json({error:"Origine refusée."},{status:403});} const c=await context(); if(c.error)return NextResponse.json({error:c.error},{status:c.error==="Session requise."?401:503}); const signals=detectGoalSignals(c.goals??[]); if(!signals.length)return NextResponse.json({published:true,count:0,proactive:{status:"no_signal"}}); const a=admin(); const notifications=signals.map(s=>({user_id:c.user!.id,type:"system",severity:s.severity,title:s.title,message:s.message,action_href:s.actionHref,dedupe_key:`goal-watch:${s.id}`})); const {error}=await a.from("notifications").upsert(notifications,{onConflict:"user_id,dedupe_key",ignoreDuplicates:true}); if(error)return NextResponse.json({error:"Publication des objectifs indisponible."},{status:503}); const proactive=await runProactiveFinancialLoop(c.s!,c.user!.id,signals[0].id,{serverMode:true}).catch(e=>({status:"failed",error:e instanceof Error?e.message:"Boucle indisponible."})); return NextResponse.json({published:true,count:signals.length,proactive}); }
