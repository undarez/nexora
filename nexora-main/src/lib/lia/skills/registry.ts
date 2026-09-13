import type { SupabaseClient } from "@supabase/supabase-js";

export type SkillHit = {
  skill_id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  status: "validated" | "active";
  trust_score: number;
  version: number;
  content: string;
};

export async function searchLiaSkills(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  category?: string,
  limit = 8,
): Promise<SkillHit[]> {
  const { data, error } = await supabase.rpc("lia_search_skills", {
    p_user_id: userId,
    p_query: query.slice(0, 300),
    p_category: category ?? null,
    p_limit: Math.min(Math.max(limit, 1), 20),
  });
  if (error) throw new Error(`Skill registry indisponible : ${error.message}`);
  return (data ?? []) as SkillHit[];
}

export function buildSkillCandidate(input: {
  name: string;
  description: string;
  procedure: string;
  triggerContext: Record<string, unknown>;
  expectedResult?: string;
  verificationSteps?: string[];
  failureModes?: string[];
  sourceRefs?: string[];
  correction?: string;
}) {
  const content = [
    `# ${input.name}`,
    "",
    "## When to Use",
    input.description,
    "",
    "## Procedure",
    input.procedure,
    input.correction ? `\n## Correction\n${input.correction}` : "",
    "",
    "## Verification",
    ...(input.verificationSteps ?? ["Vérifier le résultat attendu avant réutilisation."]),
    "",
    "## Pitfalls",
    ...(input.failureModes ?? ["Ne jamais contourner les politiques d'autorisation."]),
  ].join("\n");

  return {
    name: input.name.slice(0, 120),
    description: input.description.slice(0, 500),
    content,
    triggerContext: input.triggerContext,
    expectedResult: input.expectedResult ?? null,
    verificationSteps: input.verificationSteps ?? [],
    failureModes: input.failureModes ?? [],
    sourceRefs: input.sourceRefs ?? [],
    // Memory Gate: candidate only. These booleans must be backed by evidence before validation.
    memoryGate: {
      useful: true,
      reliable: false,
      reproducible: false,
      generalizable: false,
      obsolete: false,
      evidence_required: true,
    },
  };
}
