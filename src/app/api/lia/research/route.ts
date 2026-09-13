import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { assertSameOrigin } from "@/lib/security/csrf";
import { evaluateResearch, type ResearchEvidence } from "@/lib/lia/research/evidence";
export async function POST(request:Request){
 try{assertSameOrigin(request)}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"forbidden"},{status:403})}
 const supabase=await createClient(); if(!supabase)return NextResponse.json({error:"supabase_not_configured"},{status:503});
 const {data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({error:"unauthorized"},{status:401});
 const body=await request.json().catch(()=>null); if(!body||typeof body.query!=="string"||!body.query.trim())return NextResponse.json({error:"query_required"},{status:400});
 const evidence=Array.isArray(body.evidence)?body.evidence.filter((x:unknown):x is ResearchEvidence=>!!x&&typeof x==="object"&&typeof (x as ResearchEvidence).id==="string"&&typeof (x as ResearchEvidence).claim==="string"&&!!(x as ResearchEvidence).source&&typeof (x as ResearchEvidence).source.tier==="string").slice(0,50):[];
 const result=evaluateResearch(body.query.trim(),evidence);
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL, secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(url&&secret){const admin=createAdminClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}}); const {error}=await admin.from("lia_research_runs").insert({user_id:user.id,query:result.query,evidence:result.evidence,claims:result.claims,contradictions:result.contradictions,stale_evidence:result.staleEvidence,unknowns:result.unknowns,minimum_evidence_met:result.minimumEvidenceMet,knowledge_graph_ready:result.knowledgeGraphReady,activation_allowed:false}); if(error)return NextResponse.json({error:"research_persistence_failed",detail:error.message,result},{status:500});}
 return NextResponse.json({status:result.minimumEvidenceMet?"research_verified":"research_review",...result});
}
