import type { SupabaseClient } from "@supabase/supabase-js";
import { loadLiaProcedures, selectProcedure, type LiaProcedure } from "@/lib/lia/procedure-engine";

export type LiaDecisionPlan = {
  procedure: LiaProcedure | null;
  plan: ReturnType<typeof selectProcedure> | null;
  riskClass: "read" | "recommendation" | "write-sensitive" | "critical";
  autonomyLevel: number;
  maxAutonomyLevel: number;
  humanGateRequired: boolean;
  status: "planned" | "blocked" | "awaiting_human";
  reason: string;
};

function riskRank(value: string): number {
  return value === "critical" ? 3 : value === "write-sensitive" ? 2 : value === "recommendation" ? 1 : 0;
}

export async function buildLiaDecisionPlan(args: {
  supabase: SupabaseClient;
  userId: string;
  objective: string;
  financialContext: boolean;
  budgetContext: boolean;
  externalInformation: boolean;
}) : Promise<LiaDecisionPlan> {
  const { data: autonomy } = await args.supabase.rpc("get_lia_autonomy", { p_user_id: args.userId });
  const autonomyLevel = Number(autonomy ?? 0);
  const { data: autonomyProfile } = await args.supabase.from("lia_autonomy_profiles").select("max_autonomy_level").eq("user_id", args.userId).maybeSingle();
  const maxAutonomyLevel = Number(autonomyProfile?.max_autonomy_level ?? autonomyLevel);
  const { data: relational } = await args.supabase.from("lia_user_relationship_profiles").select("consented_personalization").eq("user_id", args.userId).maybeSingle();
  const consentedPersonalization = relational?.consented_personalization === true;
  const procedures = await loadLiaProcedures(args.supabase, undefined, 6);
  const candidates = procedures
    .map((procedure) => selectProcedure(procedure, { autonomyLevel, consentedPersonalization, externalInformation: args.externalInformation, financialContext: args.financialContext, budgetContext: args.budgetContext }))
    .filter((selection) => selection.applicable || selection.blocked);

  // Prefer the procedure that directly matches the current context, then lower-risk procedures.
  const preferred = candidates.find((x) => x.procedure.slug === "relational_adaptation" && consentedPersonalization)
    ?? candidates.find((x) => x.procedure.slug === "research_and_verify" && args.externalInformation)
    ?? candidates.find((x) => x.procedure.slug === "budget_health_check" && args.budgetContext)
    ?? candidates.find((x) => x.procedure.slug === "financial_snapshot_review" && args.financialContext)
    ?? candidates.find((x) => x.applicable)
    ?? candidates[0];

  if (!preferred) return { procedure: null, plan: null, riskClass: "read", autonomyLevel, maxAutonomyLevel, humanGateRequired: false, status: "planned", reason: "aucune procédure applicable" };

  const riskClass = preferred.procedure.risk_class;
  const humanGateRequired = preferred.procedure.human_approval_required || riskRank(riskClass) >= 2;
  const blocked = preferred.blocked || autonomyLevel < preferred.procedure.minimum_autonomy || autonomyLevel > maxAutonomyLevel;
  return {
    procedure: preferred.procedure,
    plan: preferred,
    riskClass,
    autonomyLevel,
    maxAutonomyLevel,
    humanGateRequired,
    status: blocked ? "blocked" : humanGateRequired ? "awaiting_human" : "planned",
    reason: blocked ? preferred.reason : humanGateRequired ? "validation humaine requise par la procédure/politique" : "procédure applicable et bornée",
  };
}

export async function persistLiaDecision(args: {
  supabase: SupabaseClient;
  userId: string;
  objective: string;
  plan: LiaDecisionPlan;
  context?: Record<string, unknown>;
}) {
  const { data, error } = await args.supabase.rpc("lia_record_decision", {
    p_user_id: args.userId,
    p_procedure_id: args.plan.procedure?.id ?? null,
    p_objective: args.objective.slice(0, 2000),
    p_context: args.context ?? {},
    p_decision: { procedure: args.plan.procedure?.slug ?? null, reason: args.plan.reason },
    p_risk_class: args.plan.riskClass,
    p_autonomy_level: args.plan.autonomyLevel,
    p_human_gate_required: args.plan.humanGateRequired,
    p_status: args.plan.status,
    p_reason: args.plan.reason,
  });
  if (error) throw new Error(error.message);
  return data as string;
}
