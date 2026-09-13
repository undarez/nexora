import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { assertSameOrigin } from "@/lib/security/csrf";
import { observeExecutedAction } from "@/lib/lia/observation/post-action";

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch { return NextResponse.json({error:"Requête refusée."},{status:403}); }
  const supabase=await createClient(); if(!supabase) return NextResponse.json({error:"Supabase non configuré."},{status:503});
  const {data:{user}}=await supabase.auth.getUser(); if(!user) return NextResponse.json({error:"Authentification requise."},{status:401});
  const body=await request.json().catch(()=>null) as { proposal_id?:unknown } | null;
  const proposalId=typeof body?.proposal_id === "string" ? body.proposal_id : "";
  if(!proposalId) return NextResponse.json({error:"proposal_id invalide."},{status:400});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL; const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY; if(!url||!secret)return NextResponse.json({error:"Runtime serveur incomplet."},{status:503});
  const admin=createAdminClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:p,error:pe}=await admin.from("lia_action_proposals").select("id,user_id,action_key,payload,rollback_payload,status").eq("id",proposalId).eq("user_id",user.id).single();
  if(pe||!p)return NextResponse.json({error:"Proposition introuvable."},{status:404});
  if(p.status!=="executed")return NextResponse.json({error:"L'action n'est pas exécutée."},{status:409});
  const payload=(p.payload??{}) as Record<string,unknown>; const loopRunId=typeof payload.loop_run_id === "string" ? payload.loop_run_id : null;
  const rollback=(p.rollback_payload??{}) as Record<string,unknown>;
  const result=await observeExecutedAction(admin,{proposalId,userId:user.id,actionKey:p.action_key,loopRunId,expected:{recommendation_id:rollback.recommendation_id}});
  const {data:obs,error:oe}=await admin.from("lia_action_observations").upsert({proposal_id:proposalId,loop_run_id:loopRunId,user_id:user.id,action_key:p.action_key,expected:{recommendation_id:rollback.recommendation_id ?? null},observed:result.observed,outcome:result.outcome,checks:result.checks},{onConflict:"proposal_id"}).select("id,outcome,created_at").single();
  if(oe)return NextResponse.json({error:oe.message},{status:500});
  if(loopRunId){
    await admin.from("agent_loop_steps").insert({loop_run_id:loopRunId,step_order:100,agent_key:"lia",status:result.outcome==="verified"?"completed":"failed",input:{proposal_id:proposalId},output:{post_action:result}});
    await admin.from("agent_loop_runs").update({status:result.outcome==="verified"?"completed":"failed",decision:{type:"post_action_observation",outcome:result.outcome,observation_id:obs.id},completed_at:new Date().toISOString()}).eq("id",loopRunId);
    try {
      const { error: learningError } = await admin.from("lia_learning_records").insert({user_id:user.id,loop_run_id:loopRunId,context:{source:"post_action_observation",proposal_id:proposalId},action:{action_key:p.action_key},expected_result:result.checks.reduce((a,c)=>({...a,[c.key]:c.expected}),{}),actual_result:result.observed,cause:result.outcome==="verified"?"Post-condition vérifiée":"Post-condition non vérifiée ou inconclusive",correction:{},validation:{validated_by:"deterministic_post_condition",validated_at:new Date().toISOString(),outcome:result.outcome},lesson:result.outcome==="verified"?"L'état réel correspond aux post-conditions attendues.":"Ne pas considérer une action comme réussie sans vérifier l'état réel.",abstraction:"post_action_verification",reproducible:result.outcome==="verified",confidence:result.outcome==="verified"?100:50,memory_gate:"candidate"});
      if (learningError) console.warn("Impossible d'enregistrer l'apprentissage post-action:", learningError.message);
    } catch (learningError) {
      console.warn("Impossible d'enregistrer l'apprentissage post-action:", learningError instanceof Error ? learningError.message : learningError);
    }
  }
  return NextResponse.json({status:"observed",observation:obs,result});
}
