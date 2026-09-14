import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { discoverTrustedSources } from "@/lib/lia/research/search";
import { getLiaRuntimeControls } from "@/lib/lia/runtime/controls";

export async function POST(request:Request){
 try{assertSameOrigin(request);}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"forbidden"},{status:403});}
 const supabase=await createClient(); if(!supabase)return NextResponse.json({error:"supabase_not_configured"},{status:503});
 const {data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({error:"unauthorized"},{status:401});
 const controls=await getLiaRuntimeControls(supabase);
 if(!controls.ai_enabled)return NextResponse.json({error:"lia_disabled",detail:"LIA est désactivée par l'administrateur."},{status:503});
 if(!controls.web_research_enabled)return NextResponse.json({error:"web_research_disabled",detail:"La recherche Internet est désactivée par l'administrateur."},{status:503});
 const body=await request.json().catch(()=>null);
 if(!body||typeof body.query!=="string"||!body.query.trim())return NextResponse.json({error:"query_required"},{status:400});
 try{const result=await discoverTrustedSources(body.query,typeof body.limit==="number"?body.limit:5); return NextResponse.json({query:body.query.trim(),...result,executionAllowed:false,transport:"server_web_cage"});}
 catch(e){return NextResponse.json({error:"search_failed",detail:e instanceof Error?e.message:"unknown"},{status:502});}
}
