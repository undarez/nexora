import type { SupabaseClient } from "@supabase/supabase-js";
import { memoizeLia } from "@/lib/lia/cache";

export type LiaProcedure = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  trigger_conditions: Record<string, unknown>;
  steps: string[];
  verification_rules: string[];
  failure_modes: string[];
  risk_class: "read" | "recommendation" | "write-sensitive" | "critical";
  minimum_autonomy: number;
  human_approval_required: boolean;
  status: "validated" | "active";
  version: number;
};

export type ProcedureSelection = {
  procedure: LiaProcedure;
  applicable: boolean;
  blocked: boolean;
  reason: string;
};

const LIMIT = 6;

export async function loadLiaProcedures(
  supabase: SupabaseClient,
  category?: string,
  limit = LIMIT,
): Promise<LiaProcedure[]> {
  const safeLimit = Math.min(Math.max(limit, 1), LIMIT);
  const cacheKey = `lia:procedures:${category ?? "*"}:${safeLimit}`;
  return memoizeLia(cacheKey, 60_000, async () => {
    let query = supabase
      .from("lia_procedures")
      .select("id,slug,name,description,category,trigger_conditions,steps,verification_rules,failure_modes,risk_class,minimum_autonomy,human_approval_required,status,version")
      .in("status", ["validated", "active"])
      .order("category")
      .limit(safeLimit);
    if (category) query = query.eq("category", category);
    const { data, error } = await query;
    if (error) throw new Error(`Procedure registry indisponible : ${error.message}`);
    return (data ?? []) as LiaProcedure[];
  });
}

export function selectProcedure(
  procedure: LiaProcedure,
  context: { autonomyLevel: number; consentedPersonalization: boolean; externalInformation: boolean; financialContext: boolean; budgetContext: boolean },
): ProcedureSelection {
  if (context.autonomyLevel < procedure.minimum_autonomy) {
    return { procedure, applicable: false, blocked: true, reason: "niveau d'autonomie insuffisant" };
  }
  if (procedure.slug === "relational_adaptation" && !context.consentedPersonalization) {
    return { procedure, applicable: false, blocked: true, reason: "personnalisation non consentie" };
  }
  if (procedure.slug === "research_and_verify" && !context.externalInformation) {
    return { procedure, applicable: false, blocked: false, reason: "aucune recherche externe requise" };
  }
  if (procedure.slug === "financial_snapshot_review" && !context.financialContext) {
    return { procedure, applicable: false, blocked: false, reason: "contexte financier indisponible" };
  }
  if (procedure.slug === "budget_health_check" && !context.budgetContext) {
    return { procedure, applicable: false, blocked: false, reason: "contexte budget indisponible" };
  }
  return { procedure, applicable: true, blocked: false, reason: "procédure applicable" };
}

export function buildProcedurePlan(selection: ProcedureSelection) {
  if (!selection.applicable || selection.blocked) return null;
  return {
    procedure: selection.procedure.slug,
    version: selection.procedure.version,
    steps: selection.procedure.steps,
    verification: selection.procedure.verification_rules,
    risk_class: selection.procedure.risk_class,
    human_approval_required: selection.procedure.human_approval_required,
    rule: "Les procédures décrivent une stratégie bornée; elles ne donnent jamais accès direct à la base ni aux secrets.",
  };
}
