import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";

export async function GET() {
  const supabase = await createClient(); if (!supabase) return NextResponse.json({error:"Supabase n'est pas configuré."},{status:503});
  const {data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({error:"Authentification requise."},{status:401});
  const [{data:proposals,error},{data:autonomy}] = await Promise.all([
    supabase.from("lia_action_proposals").select("id,action_key,title,description,risk_class,autonomy_level,reversible,status,expires_at,created_at").eq("user_id",user.id).in("status",["proposed","approved"]).order("created_at",{ascending:false}).limit(20),
    supabase.rpc("get_lia_autonomy",{p_user_id:user.id})
  ]);
  if(error){
    const missing = /schema cache|could not find the table|could not find the function|function .* does not exist|relation .* does not exist|PGRST202|PGRST205|42P01|42883/i.test(error.message);
    if(missing) return NextResponse.json({proposals:[],autonomy_level:1,degraded:true,reason:"action_storage_unavailable"});
    return NextResponse.json({error:error.message},{status:500});
  }
  return NextResponse.json({proposals:proposals??[],autonomy_level:Number(autonomy??1)});
}

export async function POST(request:Request) {
  try{assertSameOrigin(request);}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Requête refusée."},{status:403});}
  const supabase=await createClient(); if(!supabase)return NextResponse.json({error:"Supabase non configuré."},{status:503});
  const {data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({error:"Authentification requise."},{status:401});
  const body=await request.json().catch(()=>null);
  if(!body||typeof body.id!=="string"||!["approved","rejected"].includes(body.decision))return NextResponse.json({error:"Décision invalide."},{status:400});
  const {data,error}=await supabase.rpc("approve_lia_action",{p_proposal_id:body.id,p_decision:body.decision});
  if(error)return NextResponse.json({error:error.message},{status:409});
  return NextResponse.json(data);
}
