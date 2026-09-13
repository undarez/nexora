import type { SupabaseClient } from "@supabase/supabase-js";

export type RecoveryStrategy = "retry_same" | "switch_to_safe_observation" | "stop";

export type RecoveryDecision = {
  strategy: RecoveryStrategy;
  reason: string;
  nextProcedure: string | null;
  retryAllowed: boolean;
};

/** Deterministic recovery. It may change strategy, but never permissions/autonomy. */
export function decideLiaRecovery(args: {
  procedure: string;
  retryCount: number;
  error?: string | null;
  verification?: { verified?: boolean; checks?: Array<{ passed: boolean }> } | null;
}): RecoveryDecision {
  if (args.retryCount >= 3) return { strategy: "stop", reason: "Limite de récupération atteinte.", nextProcedure: null, retryAllowed: false };
  const procedure = args.procedure;
  if (procedure === "financial_snapshot_review" || procedure === "budget_health_check") {
    return { strategy: "retry_same", reason: "Échec de vérification d'une étape déterministe d'observation; nouvelle tentative bornée.", nextProcedure: procedure, retryAllowed: true };
  }
  if (procedure === "research_and_verify") {
    return { strategy: "switch_to_safe_observation", reason: "La recherche externe n'est pas exécutable ici; bascule vers une observation sûre sans écriture.", nextProcedure: "financial_snapshot_review", retryAllowed: true };
  }
  if (procedure === "relational_adaptation") {
    return { strategy: "retry_same", reason: "La personnalisation est non critique; nouvelle tentative bornée sans changement de politique.", nextProcedure: procedure, retryAllowed: true };
  }
  return { strategy: "stop", reason: args.error ? `Procédure en échec: ${args.error}` : "Procédure non reconnue; arrêt sécurisé.", nextProcedure: null, retryAllowed: false };
}

export async function recordRecovery(args: {
  supabase: SupabaseClient;
  runId: string;
  stepId: string;
  decision: RecoveryDecision;
}) {
  const now = new Date().toISOString();
  await args.supabase.from("lia_orchestration_steps").update({
    recovery_strategy: args.decision.strategy,
    recovery_reason: args.decision.reason,
    last_error: args.decision.reason,
  }).eq("id", args.stepId).eq("run_id", args.runId);
}
