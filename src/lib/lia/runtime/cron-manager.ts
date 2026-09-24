import type { SupabaseClient } from "@supabase/supabase-js";
import { nextCronRun } from "@/lib/lia/runtime/cron-scheduler";

export type LiaCronAction = "autonomous_learning" | "proactive_financial_watch" | "goal_watch" | "agent_goal" | "bank_sync" | "continuous_operations";
const ALLOWED_ACTIONS = new Set<LiaCronAction>(["autonomous_learning","proactive_financial_watch","goal_watch","agent_goal","bank_sync","continuous_operations"]);
function cleanName(value:string){return value.replace(/[^\p{L}\p{N} .:_-]/gu,"").trim().slice(0,120)||"LIA · Tâche planifiée";}
function cleanDescription(value:string){return value.replace(/[\u0000-\u001F\u007F]/g," ").trim().slice(0,500);}
function validateAction(action:unknown):asserts action is LiaCronAction{if(typeof action!=="string"||!ALLOWED_ACTIONS.has(action as LiaCronAction))throw new Error("Action Cron LIA non autorisée.");}
export async function createLiaCronJob(admin:SupabaseClient,userId:string,input:{name:string;description?:string;schedule:string;timezone?:string;action:LiaCronAction;payload?:Record<string,unknown>}){
 validateAction(input.action);const schedule=input.schedule.trim();const timezone=input.timezone?.trim()||"Europe/Paris";const now=new Date();const nextRun=nextCronRun(schedule,now,timezone);if(!nextRun)throw new Error("Impossible de calculer la prochaine exécution Cron.");
 const payload:Record<string,unknown>={...(input.payload??{}),action:input.action,created_by:"lia",autonomous:true,governed:true};
 const {data:existing}=await admin.from("lia_runtime_jobs").select("id,name,status,schedule,next_run_at").eq("user_id",userId).eq("runtime_type","cron").eq("name",cleanName(input.name)).maybeSingle();
 if(existing){const {data,error}=await admin.from("lia_runtime_jobs").update({description:cleanDescription(input.description??"Tâche autonome planifiée par LIA."),schedule,timezone,payload,status:"ready",admin_disabled:false,admin_disabled_at:null,admin_disabled_by:null,admin_disabled_reason:null,next_run_at:nextRun.toISOString(),requires_policy_gate:true,requires_human_approval:false,execution_mode:"agent",updated_at:now.toISOString()}).eq("id",existing.id).eq("user_id",userId).select("id,name,schedule,timezone,status,next_run_at,payload").single();if(error)throw new Error(`Impossible de mettre à jour le Cron LIA : ${error.message}`);return {...data,created:false,autonomous:true};}
 const {data,error}=await admin.from("lia_runtime_jobs").insert({user_id:userId,runtime_type:"cron",name:cleanName(input.name),description:cleanDescription(input.description??"Tâche autonome planifiée par LIA."),schedule,timezone,status:"ready",payload,next_run_at:nextRun.toISOString(),requires_policy_gate:true,requires_human_approval:false,execution_mode:"agent",admin_disabled:false}).select("id,name,schedule,timezone,status,next_run_at,payload").single();if(error)throw new Error(`Impossible de créer le Cron LIA : ${error.message}`);return {...data,created:true,autonomous:true};
}
