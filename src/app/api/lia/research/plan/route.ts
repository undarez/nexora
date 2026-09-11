import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { assertSameOrigin } from "@/lib/security/csrf";
import { planResearch } from "@/lib/lia/research/planner";
export async function POST(request:Request){
 try{assertSameOrigin(request)}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"forbidden"},{status:403})}
 const supabase=await createClient(); if(!supabase)return NextResponse.json({error:"supabase_not_configured"},{status:503});
 const {data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({error:"unauthorized"},{status:401});
 const body=await request.json().catch(()=>null); if(!body||typeof body.query!=="string"||!body.query.trim())return NextResponse.json({error:"query_required"},{status:400});
 const plan=planResearch(body.query,Array.isArray(body.unknowns)?body.unknowns:[],typeof body.maxSteps==="number"?body.maxSteps:5);
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL, secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(url&&secret){const admin=createAdminClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}});const {error}=await admin.from("lia_research_plans").insert({user_id:user.id,query:plan.query,unknowns:plan.unknowns,steps:plan.steps,stop_rules:plan.stopRules,max_sources_per_step:plan.maxSourcesPerStep,execution_allowed:false});if(error)return NextResponse.json({error:"research_plan_persistence_failed",detail:error.message},{status:500});}
 return NextResponse.json({status:"research_plan_ready",...plan});
}
