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

const normalize = (value: string) => value.toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export async function selectRelevantLiaSkills(
  supabase: SupabaseClient,
  userId: string,
  objective: string,
  options: { category?: string; limit?: number; minimum?: number } = {},
): Promise<SkillHit[]> {
  const limit = Math.min(Math.max(options.limit ?? 8, 1), 12);
  const cleanObjective = objective.trim().slice(0, 1000);
  const objectiveTokens = new Set(normalize(cleanObjective).split(/\s+/).filter(token => token.length >= 4));
  const queries = [
    cleanObjective,
    "analyse budget dépenses épargne prévision risque",
    "vérification déterministe analyse financière",
  ];
  const batches = await Promise.all(queries.map(query =>
    searchLiaSkills(supabase, userId, query, options.category, Math.min(20, limit * 2)).catch(() => []),
  ));
  const candidates = new Map<string, SkillHit>();
  for (const batch of batches) for (const skill of batch) candidates.set(skill.skill_id, skill);
  const scored = [...candidates.values()].map(skill => {
    const tokens = new Set(normalize(`${skill.name} ${skill.description} ${skill.content}`).split(/\s+/).filter(token => token.length >= 4));
    let overlap = 0;
    for (const token of objectiveTokens) if (tokens.has(token)) overlap++;
    const baseline = skill.slug === "financial-agent-intelligence" ? 0.35 : 0;
    const trust = Math.max(0, Math.min(1, Number(skill.trust_score || 0) / 100));
    return { skill, score: overlap * 1.5 + trust * 0.25 + baseline };
  }).sort((a, b) => b.score - a.score);
  const selected = scored.slice(0, limit).map(entry => entry.skill);
  const minimum = Math.min(Math.max(options.minimum ?? 2, 1), limit);
  if (selected.length < minimum) {
    const baseline = [...candidates.values()].find(skill => skill.slug === "financial-agent-intelligence");
    if (baseline && !selected.some(skill => skill.skill_id === baseline.skill_id)) selected.push(baseline);
  }
  return selected.slice(0, limit);
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
    name: input.name.slice(0, 120), description: input.description.slice(0, 500), content,
    triggerContext: input.triggerContext, expectedResult: input.expectedResult ?? null,
    verificationSteps: input.verificationSteps ?? [], failureModes: input.failureModes ?? [], sourceRefs: input.sourceRefs ?? [],
    memoryGate: { useful: true, reliable: false, reproducible: false, generalizable: false, obsolete: false, evidence_required: true },
  };
}
