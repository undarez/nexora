import type { SupabaseClient } from "@supabase/supabase-js";

export type UseCaseHit = {
  use_case_id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  objective: string;
  trigger: string;
  required_skills: string[];
  suggested_tools: string[];
  risk_class: "read" | "recommendation" | "write-sensitive" | "critical";
  minimum_autonomy: number;
  human_approval_required: boolean;
  success_criteria: string[];
  verification_rules: string[];
  status: "validated" | "active";
  trust_score: number;
  version: number;
};

export async function searchLiaUseCases(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  category?: string,
  limit = 8,
): Promise<UseCaseHit[]> {
  const { data, error } = await supabase.rpc("lia_search_use_cases", {
    p_user_id: userId,
    p_query: query.slice(0, 300),
    p_category: category ?? null,
    p_limit: Math.min(Math.max(limit, 1), 20),
  });
  if (error) throw new Error(`Use Case Registry indisponible : ${error.message}`);
  return (data ?? []) as UseCaseHit[];
}

export function buildUseCaseCandidate(input: {
  name: string;
  description: string;
  objective: string;
  trigger: string;
  requiredContext: string[];
  requiredSkills: string[];
  suggestedTools: string[];
  riskClass: UseCaseHit["risk_class"];
  minimumAutonomy: number;
  humanApprovalRequired: boolean;
  successCriteria: string[];
  verificationRules: string[];
}) {
  return {
    ...input,
    name: input.name.slice(0, 160),
    description: input.description.slice(0, 700),
    objective: input.objective.slice(0, 1200),
    trigger: input.trigger.slice(0, 800),
    minimumAutonomy: Math.min(Math.max(input.minimumAutonomy, 0), 8),
  };
}
