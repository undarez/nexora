import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { liaChat, type LiaProviderMessage } from "@/lib/lia/provider";
import { buildReplayReport } from "@/lib/lia/replay-harness";

type Skill = { id:string; slug:string; name:string; description:string; category:string; status:string; trust_score:number|null; active_version_id:string|null };
type Version = { id:string; version:number; content:string };

const clamp = (n:number,min=0,max=100) => Math.max(min,Math.min(max,Math.round(Number.isFinite(n)?n:min)));
const clean = (s:unknown,max:number) => typeof s === "string" ? s.trim().slice(0,max) : "";
const fingerprint = (s:string) => createHash("sha256").update(s.slice(0,30000),"utf8").digest("hex");

function parseJson(raw:string):Record<string,unknown>|null {
  const body=raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] ?? raw;
  const a=body.indexOf("{"), b=body.lastIndexOf("}");
  if(a<0||b<=a)return null;
  try{return JSON.parse(body.slice(a,b+1)) as Record<string,unknown>}catch{return null}
}

async function challengeSkill(skill:Skill, version:Version, gaps:string[]) {
  const system = [
    "Tu es le Challenger gouverné du laboratoire de Skills de LIA.",
    "Ta mission est de construire des cas difficiles qui pourraient faire échouer la procédure.",
    "Ne demande aucun outil externe et ne modifie aucune donnée.",
    "Retourne uniquement JSON: {challenges:[{name,input,expectedFailure,checks:string[]}]}.",
    "Maximum 3 challenges. Chaque challenge doit tester une faiblesse concrète, la vérification et la sécurité.",
  ].join("\n");
  const user = JSON.stringify({skill:{slug:skill.slug,name:skill.name,description:skill.description,category:skill.category},version:version.version,content:version.content.slice(0,12000),knownGaps:gaps.slice(0,8)}).slice(0,18000);
  try {
    const result=await liaChat([{role:"system",content:system},{role:"user",content:user}] satisfies LiaProviderMessage[]);
    const parsed=parseJson(result.content);
    const raw=Array.isArray(parsed?.challenges)?parsed?.challenges:[];
    return raw.slice(0,3).map((x:any)=>({name:clean(x?.name,120)||"Challenge",input:clean(x?.input,2500),expectedFailure:clean(x?.expectedFailure,500),checks:Array.isArray(x?.checks)?x.checks.filter((v:any)=>typeof v==="string").slice(0,6).map((v:string)=>v.slice(0,300)):[]})).filter(x=>x.input.length>=20);
  } catch { return []; }
}

async function proposeVersion(skill:Skill, version:Version, gaps:string[], challengeInputs:string[]) {
  const system = [
    "Tu es le Skill Improver gouverné de LIA.",
    "Propose une version candidate plus robuste de la procédure fournie.",
    "Tu ne changes jamais permissions, policies, faits financiers ou autorité.",
    "Conserve les garde-fous existants et ajoute seulement des corrections procédurales vérifiables.",
    "Retourne uniquement JSON: {content,description,expectedResult,verificationSteps,failureModes}.",
    "Le contenu doit être autonome, précis, sans chaîne de pensée, maximum 24000 caractères.",
  ].join("\n");
  const user=JSON.stringify({skill:{name:skill.name,description:skill.description,category:skill.category},baseline:version.content.slice(0,14000),gaps:gaps.slice(0,8),challengeInputs:challengeInputs.slice(0,3)}).slice(0,22000);
  try {
    const result=await liaChat([{role:"system",content:system},{role:"user",content:user}] satisfies LiaProviderMessage[]);
    const parsed=parseJson(result.content);
    const content=clean(parsed?.content,24000);
    if(content.length<40)return null;
    return {content,description:clean(parsed?.description,1000)||skill.description,expectedResult:clean(parsed?.expectedResult,1000),verificationSteps:Array.isArray(parsed?.verificationSteps)?parsed.verificationSteps.filter((x:any)=>typeof x==="string").slice(0,10):[],failureModes:Array.isArray(parsed?.failureModes)?parsed.failureModes.filter((x:any)=>typeof x==="string").slice(0,10):[]};
  } catch { return null; }
}

export async function runSkillImprovementLab(admin:SupabaseClient,userId:string,skillId:string,gaps:string[]=[]){
  const {data:skill,error:skillError}=await admin.from("lia_skills").select("id,slug,name,description,category,status,trust_score,active_version_id").eq("id",skillId).maybeSingle();
  if(skillError||!skill)throw new Error("skill_not_found");
  if(!["active","validated"].includes(String(skill.status)))return {status:"blocked",reason:"skill_not_eligible_for_improvement"};
  const skillRow=skill as Skill;
  const versionQuery=skillRow.active_version_id
    ? admin.from("lia_skill_versions").select("id,version,content").eq("id",skillRow.active_version_id).maybeSingle()
    : admin.from("lia_skill_versions").select("id,version,content").eq("skill_id",skillId).order("version",{ascending:false}).limit(1).maybeSingle();
  const {data:version,error:versionError}=await versionQuery;
  if(versionError||!version)throw new Error("skill_version_not_found");
  const baseline=version as Version;
  const {data:lab,error:labError}=await admin.from("lia_skill_lab_runs").insert({user_id:userId,baseline_skill_id:skillId,baseline_version_id:baseline.id,status:"running",evidence:{governed:true,external_research:false,financial_writes_allowed:false,activation_allowed:false}}).select("id").single();
  if(labError||!lab)throw new Error("skill_lab_create_failed");

  try{
    const challenges=await challengeSkill(skillRow,baseline,gaps);
    const candidate=await proposeVersion(skillRow,baseline,gaps,challenges.map(x=>x.input));
    if(!candidate){
      await admin.from("lia_skill_lab_runs").update({status:"blocked",challenge_count:challenges.length,challenge_failures:challenges.length,completed_at:new Date().toISOString(),evidence:{reason:"candidate_generation_failed",challenge_fingerprints:challenges.map(x=>fingerprint(x.input)),activation_allowed:false}}).eq("id",lab.id);
      return {status:"blocked",labId:lab.id,reason:"candidate_generation_failed"};
    }

    const replay=buildReplayReport({baselineContent:baseline.content,candidateContent:candidate.content});
    const challengeFailures=challenges.filter(x=>!x.expectedFailure).length;
    const slug=`${skillRow.slug}-candidate-${fingerprint(candidate.content).slice(0,10)}`;
    const {data:newSkillId,error:createError}=await admin.rpc("lia_create_skill_candidate",{p_user_id:userId,p_scope:"global",p_slug:slug,p_name:`${skillRow.name} — Candidate`,p_description:candidate.description,p_category:skillRow.category,p_source_type:"corrected",p_content:candidate.content,p_trigger_context:{chapter:6,baseline_skill_id:skillId,lab_id:lab.id},p_expected_result:candidate.expectedResult,p_verification_steps:candidate.verificationSteps,p_failure_modes:candidate.failureModes,p_source_refs:[{type:"baseline_skill",skill_id:skillId,version:baseline.version}],p_memory_gate:{useful:true,reliable:true,reproducible:true,generalizable:true,obsolete:false,evidence_required:true}});
    if(createError||!newSkillId)throw new Error(createError?.message||"candidate_skill_creation_failed");
    const {data:newVersion}=await admin.from("lia_skill_versions").select("id,version").eq("skill_id",newSkillId).order("version",{ascending:false}).limit(1).maybeSingle();

    const eligible=Boolean(replay.eligibleForReview);
    if(eligible){
      await admin.from("lia_learning_review_board").insert({
        skill_id:newSkillId,skill_version_id:newVersion?.id??null,title:`Amélioration candidate — ${skillRow.name}`,category:skillRow.category,
        verdict:replay.comparison.verdict,baseline_score:clamp(replay.baseline.score),candidate_score:clamp(replay.candidate.score),score_delta:replay.comparison.delta,
        regressions:replay.comparison.regressions,review_note:"Proposition issue du Skill Laboratory Chapter 6. Revue humaine requise avant promotion.",authority:{skillActivation:false,modelWeightUpdate:false,policyUpdate:false,financialFactUpdate:false,permissionUpdate:false}
      });
    }
    await admin.from("lia_skill_lab_runs").update({
      status:"completed",candidate_skill_id:newSkillId,candidate_version_id:newVersion?.id??null,challenge_count:challenges.length,
      challenge_failures:challengeFailures,replay_score:replay.candidate.score,verdict:replay.comparison.verdict,
      regressions:replay.comparison.regressions,improvements:replay.comparison.improvedCases,
      evidence:{eligible_for_review:eligible,baseline_fingerprint:replay.baselineFingerprint,candidate_fingerprint:replay.candidateFingerprint,challenge_fingerprints:challenges.map(x=>fingerprint(x.input)),activation_allowed:false},
      completed_at:new Date().toISOString()
    }).eq("id",lab.id);
    return {status:"completed",labId:lab.id,candidateSkillId:newSkillId,candidateVersionId:newVersion?.id??null,replay:replay.comparison,eligibleForHumanReview:eligible,activationAllowed:false};
  }catch(error){
    await admin.from("lia_skill_lab_runs").update({status:"failed",completed_at:new Date().toISOString(),evidence:{error:error instanceof Error?error.message:"skill_lab_failed",activation_allowed:false}}).eq("id",lab.id);
    throw error;
  }
}
