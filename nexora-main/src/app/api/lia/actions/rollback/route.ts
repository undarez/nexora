import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { assertSameOrigin } from "@/lib/security/csrf";

export async function POST(request:Request){
  try{assertSameOrigin(request);}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Requête refusée."},{status:403});}
  const supabase=await createClient(); if(!supabase)return NextResponse.json({error:"Supabase non configuré."},{status:503});
  const {data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({error:"Authentification requise."},{status:401});
  const body=await request.json().catch(()=>null); if(!body||typeof body.id!=="string")return NextResponse.json({error:"Proposition invalide."},{status:400});
  const {data:p,error:pe}=await supabase.from("lia_action_proposals").select("*").eq("id",body.id).eq("user_id",user.id).single();
  if(pe||!p)return NextResponse.json({error:"Proposition introuvable."},{status:404});
  if(p.status!=="executed"||!p.reversible)return NextResponse.json({error:"Cette action n'est pas réversible dans son état actuel."},{status:409});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL; const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY; if(!url||!secret)return NextResponse.json({error:"Runtime serveur incomplet."},{status:503});
  const admin=createAdminClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}});
  const rollback=(p.rollback_payload??{}) as Record<string,unknown>; const recommendationId=typeof rollback.recommendation_id==='string'?rollback.recommendation_id:'';
  if(p.action_key!=="create_recommendation"||!recommendationId)return NextResponse.json({error:"Rollback non autorisé."},{status:403});
  const {error:de}=await admin.from("recommendations").delete().eq("id",recommendationId).eq("user_id",user.id); if(de)return NextResponse.json({error:de.message},{status:500});
  await admin.from("lia_action_proposals").update({status:"rolled_back"}).eq("id",p.id);
  await admin.from("lia_action_audit").insert({proposal_id:p.id,user_id:user.id,agent_id:p.agent_id,event:"rolled_back",actor:"human",metadata:{recommendation_id:recommendationId}});
  return NextResponse.json({status:"rolled_back"});
}
