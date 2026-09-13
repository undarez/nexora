import type { SupabaseClient } from "@supabase/supabase-js";
import { getLiaPrincipal } from "@/lib/security/agent-identity";
import { assertLiaActionCanBePlanned } from "@/lib/lia/actions/boundary";

export type LiaActionPlan = {
  actionKey: string;
  title: string;
  description: string;
  riskClass: "read" | "recommendation" | "write" | "critical";
  autonomyLevel: number;
  reversible: boolean;
  requiresHumanApproval: boolean;
  payload: Record<string, unknown>;
};

const WRITE_ACTIONS = new Set(["create_recommendation"]);

export function planLiaAction(input: {
  actionKey: string;
  title: string;
  description: string;
  payload?: Record<string, unknown>;
  autonomyLevel?: number;
}): LiaActionPlan {
  const level = Math.max(0, Math.min(8, Math.floor(input.autonomyLevel ?? 1)));
  assertLiaActionCanBePlanned(input.actionKey);
  if (!WRITE_ACTIONS.has(input.actionKey)) {
    return { actionKey: input.actionKey, title: input.title.slice(0,200), description: input.description.slice(0,1000),
      riskClass: "critical", autonomyLevel: level, reversible: false, requiresHumanApproval: true, payload: input.payload ?? {} };
  }
  return { actionKey: input.actionKey, title: input.title.slice(0,200), description: input.description.slice(0,1000),
    riskClass: "recommendation", autonomyLevel: level, reversible: true, requiresHumanApproval: true, payload: input.payload ?? {} };
}

/** Creates a proposal only. It never executes an action. */
export async function createHumanGatedProposal(args: {
  supabase: SupabaseClient; userId: string; loopRunId?: string | null; plan: LiaActionPlan;
}) {
  if (!args.plan.requiresHumanApproval) throw new Error("Une action sans validation humaine ne peut pas utiliser ce flux.");
  const principal = getLiaPrincipal(args.userId);
  const payload = { ...args.plan.payload, ...(args.loopRunId ? { loop_run_id: args.loopRunId } : {}) };
  const executionKey = `${args.plan.actionKey}:${args.loopRunId ?? "none"}:${Date.now()}`;
  const { data, error } = await args.supabase.from("lia_action_proposals").insert({
    user_id: args.userId, agent_id: principal.agentId, action_key: args.plan.actionKey,
    title: args.plan.title, description: args.plan.description, risk_class: args.plan.riskClass,
    autonomy_level: args.plan.autonomyLevel, reversible: args.plan.reversible, payload,
    execution_key: executionKey, status: "proposed",
    expires_at: new Date(Date.now() + 24*60*60*1000).toISOString(),
  }).select("id,action_key,title,description,risk_class,autonomy_level,reversible,status,expires_at,created_at").single();
  if (error) throw new Error(error.message);
  return data;
}
