import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { assertSameOrigin } from "@/lib/security/csrf";
import { getLiaPrincipal } from "@/lib/security/agent-identity";
import { recordAgentLoopStep, finishAgentLoop } from "@/lib/agents/loop-engine";
import { observeExecutedAction } from "@/lib/lia/observation/post-action";
import { learnFromObservation } from "@/lib/lia/adaptive-learning";
import { assertLiaActionCanBeExecuted } from "@/lib/lia/actions/boundary";

export async function POST(request:Request){
  try{assertSameOrigin(request);}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Requête refusée."},{status:403});}
  const supabase=await createClient(); if(!supabase)return NextResponse.json({error:"Supabase non configuré."},{status:503});
  const {data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({error:"Authentification requise."},{status:401});
  const body=await request.json().catch(()=>null); if(!body||typeof body.id!=="string")return NextResponse.json({error:"Proposition invalide."},{status:400});
  const {data:p,error:pe}=await supabase.from("lia_action_proposals").select("*").eq("id",body.id).eq("user_id",user.id).single();
  if(pe||!p)return NextResponse.json({error:"Proposition introuvable."},{status:404});
  if(p.status!=="approved")return NextResponse.json({error:"La proposition doit être approuvée avant exécution."},{status:409});
  if(p.expires_at&&new Date(p.expires_at)<new Date())return NextResponse.json({error:"La proposition a expiré."},{status:409});
  if(p.user_id!==user.id)return NextResponse.json({error:"Proposition hors périmètre."},{status:403});
  if(p.agent_id!==getLiaPrincipal(user.id).agentId)return NextResponse.json({error:"Identité agent invalide."},{status:403});
  try { assertLiaActionCanBeExecuted(p.action_key, p.status === "approved"); } catch (e) { return NextResponse.json({error:e instanceof Error?e.message:"Action non autorisée par le runtime."},{status:403}); }
  if(!p.reversible)return NextResponse.json({error:"Action non réversible refusée par le runtime."},{status:403});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL; const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY; if(!url||!secret)return NextResponse.json({error:"Runtime serveur incomplet."},{status:503});
  const admin=createAdminClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}});
  const principal=getLiaPrincipal(user.id);
  const {data:autonomy,error:autonomyError}=await supabase.rpc("get_lia_autonomy",{p_user_id:user.id});
  if(autonomyError)return NextResponse.json({error:"Impossible de vérifier l'autonomie LIA."},{status:503});
  const {data:policy,error:policyError}=await admin.rpc("authorize_lia_tool",{p_agent_id:principal.agentId,p_user_id:user.id,p_organization_id:principal.organizationId,p_tool_key:p.action_key,p_autonomy_level:Number(autonomy??1)});
  if(policyError||!policy?.allowed && policy?.reason!=="human_approval_required")return NextResponse.json({error:"Policy Engine : exécution refusée."},{status:403});
  const payload=(p.payload??{}) as Record<string,unknown>; const title=typeof payload.title==='string'?payload.title.slice(0,200):'Recommandation IA'; const recBody=typeof payload.body==='string'?payload.body.slice(0,10000):''; if(!recBody)return NextResponse.json({error:"Contenu invalide."},{status:400});
  const { data: claim, error: claimError } = await supabase.rpc("claim_lia_action_for_execution", { p_proposal_id: p.id });
  if (claimError || !claim || claim.status !== "executing") return NextResponse.json({error:claimError?.message ?? "Impossible de réserver l'exécution."},{status:409});
  const {data:rec,error:re}=await admin.from("recommendations").insert({user_id:user.id,type:"ai_analysis",title,body:recBody,status:"proposed",rule_ids:[]}).select("id,created_at").single();
  if(re){
    await admin.from("lia_action_proposals").update({status:"failed",failed_at:new Date().toISOString(),failure_code:"recommendation_insert_failed"}).eq("id",p.id).eq("status","executing");
    await admin.from("lia_action_audit").insert({proposal_id:p.id,user_id:user.id,agent_id:p.agent_id,event:"execution_failed",actor:"system",metadata:{code:"recommendation_insert_failed",message:re.message}});
    return NextResponse.json({error:re.message},{status:500});
  }
  await admin.from("lia_action_proposals").update({status:"executed",executed_at:new Date().toISOString(),rollback_payload:{recommendation_id:rec.id}}).eq("id",p.id).eq("status","executing");
  await admin.from("lia_action_audit").insert({proposal_id:p.id,user_id:user.id,agent_id:p.agent_id,event:"executed",actor:"human_approved",metadata:{recommendation_id:rec.id,reversible:true}});
  const loopRunId = typeof payload.loop_run_id === "string" ? payload.loop_run_id : null;
  const postAction = await observeExecutedAction(admin,{proposalId:p.id,userId:user.id,actionKey:p.action_key,loopRunId,expected:{recommendation_id:rec.id}});
  const { data: observation } = await admin.from("lia_action_observations").upsert({proposal_id:p.id,loop_run_id:loopRunId,user_id:user.id,action_key:p.action_key,expected:{recommendation_id:rec.id},observed:postAction.observed,outcome:postAction.outcome,checks:postAction.checks},{onConflict:"proposal_id"}).select("id,outcome").single();
  if (postAction.outcome === "verified") {
    await admin.from("lia_action_proposals").update({verified_at:new Date().toISOString()}).eq("id",p.id).eq("status","executed");
  }
  await admin.from("lia_action_audit").insert({proposal_id:p.id,user_id:user.id,agent_id:p.agent_id,event:"post_action_observed",actor:"system",metadata:{observation_id:observation?.id ?? null,outcome:postAction.outcome,checks:postAction.checks}});
  if (loopRunId) {
    await recordAgentLoopStep(supabase, loopRunId, 99, { phase:"verify", agentKey:"lia", input:{ proposal_id:p.id }, output:{ recommendation_id:rec.id, status:"executed", post_action:postAction }, status:postAction.outcome === "verified" ? "completed" : "failed" }).catch(() => undefined);
    await finishAgentLoop(supabase, loopRunId, postAction.outcome === "verified" ? "completed" : "failed", { proposal_id:p.id, recommendation_id:rec.id, observation:"post_action", observation_outcome:postAction.outcome, observation_id:observation?.id ?? null, learning_candidate:true }).catch(() => undefined);
    await learnFromObservation(admin,{ userId:user.id, loopRunId, proposalId:p.id, actionKey:p.action_key, outcome:postAction.outcome, expected:{ status:"recommendation_created", recommendation_id:rec.id }, actual:postAction.observed, checks:postAction.checks }).catch(() => undefined);
  }
  return NextResponse.json({status:"executed",recommendation_id:rec.id,loop_run_id:loopRunId});
}
