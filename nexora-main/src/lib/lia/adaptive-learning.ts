import type { SupabaseClient } from "@supabase/supabase-js";

export type LearningOutcome = "verified" | "mismatch" | "inconclusive" | "failed";
export type LearningDiagnosis = {
  cause: string;
  correction: string;
  lesson: string;
  reproducible: boolean;
  confidence: number;
  shouldCreateCandidate: boolean;
};

/** Deterministic learning synthesizer. It never activates a skill or changes policy. */
export function diagnoseLearning(input: {
  outcome: LearningOutcome;
  expected: Record<string, unknown>;
  actual: Record<string, unknown>;
  checks?: Array<{ key: string; expected: boolean; observed: boolean; detail: string }>;
}) : LearningDiagnosis {
  const failedChecks = (input.checks ?? []).filter(c => c.expected !== c.observed);
  if (input.outcome === "verified") return {
    cause: "Post-condition déterministe satisfaite.",
    correction: "Aucune correction nécessaire.",
    lesson: "La procédure a produit l'état attendu et sa vérification est reproductible.",
    reproducible: true, confidence: 100, shouldCreateCandidate: false,
  };
  if (input.outcome === "inconclusive") return {
    cause: "Les post-conditions disponibles ne suffisent pas pour conclure.",
    correction: "Ajouter une preuve déterministe avant de réutiliser la procédure.",
    lesson: "Une absence de preuve ne doit jamais être transformée en succès.",
    reproducible: false, confidence: 90, shouldCreateCandidate: true,
  };
  if (input.outcome === "failed") return {
    cause: failedChecks[0]?.detail || "L'observation du résultat a échoué.",
    correction: "Diagnostiquer l'erreur technique puis rejouer une vérification déterministe avant toute réutilisation.",
    lesson: "Une exécution technique réussie n'est pas suffisante : le résultat réel doit être vérifié.",
    reproducible: false, confidence: 85, shouldCreateCandidate: true,
  };
  const mismatch = failedChecks.map(c => `${c.key}: attendu=${String(c.expected)}, observé=${String(c.observed)}`).join("; ");
  return {
    cause: mismatch || "L'état réel ne correspond pas aux post-conditions attendues.",
    correction: "Conserver l'action sous surveillance et renforcer la post-condition qui a divergé.",
    lesson: "Toute divergence entre état attendu et état réel doit devenir une correction procédurale candidate, jamais une activation automatique.",
    reproducible: false, confidence: 95, shouldCreateCandidate: true,
  };
}

export async function learnFromObservation(admin: SupabaseClient, input: {
  userId: string; loopRunId?: string | null; proposalId: string; actionKey: string;
  outcome: LearningOutcome; expected: Record<string, unknown>; actual: Record<string, unknown>;
  checks?: Array<{ key: string; expected: boolean; observed: boolean; detail: string }>;
}) {
  const diagnosis = diagnoseLearning(input);
  const learning = {
    user_id: input.userId,
    loop_run_id: input.loopRunId ?? null,
    context: { source: "adaptive_post_action_learning", proposal_id: input.proposalId, action_key: input.actionKey, outcome: input.outcome },
    action: { action_key: input.actionKey },
    expected_result: input.expected,
    actual_result: input.actual,
    cause: diagnosis.cause,
    correction: { text: diagnosis.correction },
    validation: { validated_by: "deterministic_post_action", outcome: input.outcome, confidence: diagnosis.confidence },
    lesson: diagnosis.lesson,
    abstraction: "post_action_observation_to_procedural_learning",
    reproducible: diagnosis.reproducible,
    confidence: diagnosis.confidence,
    memory_gate: "candidate",
  };
  const { data, error } = await admin.from("lia_learning_records").insert(learning).select("id").single();
  if (error) throw new Error(error.message);

  let candidateSkillId: string | null = null;
  if (diagnosis.shouldCreateCandidate) {
    const slug = `post-action-${input.actionKey}-${input.outcome}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 70);
    const content = [
      `# Correction candidate — ${input.actionKey}`,
      "", "## Trigger", `Une observation post-action aboutit à ${input.outcome}.`,
      "", "## Cause", diagnosis.cause,
      "", "## Correction", diagnosis.correction,
      "", "## Verification", "Rejouer uniquement les post-conditions déterministes et comparer l'état réel.",
      "", "## Safety", "Ce skill reste candidat. Il ne modifie ni permissions, ni politiques, ni actions financières.",
    ].join("\n");
    const { data: skillId, error: skillError } = await admin.rpc("lia_create_skill_candidate", {
      p_user_id: input.userId, p_scope: "user", p_slug: slug,
      p_name: `Correction post-action ${input.actionKey}`,
      p_description: `Correction candidate issue d'une observation ${input.outcome}.`,
      p_category: "learning",
      p_source_type: "corrected",
      p_content: content,
      p_trigger_context: { action_key: input.actionKey, outcome: input.outcome },
      p_expected_result: "Post-condition déterministe vérifiée avant réutilisation.",
      p_verification_steps: ["Vérifier l'état réel", "Comparer aux post-conditions", "Ne pas activer automatiquement"],
      p_failure_modes: ["Considérer inconclusive comme success", "Contourner Policy Engine", "Activer automatiquement"],
      p_source_refs: [input.proposalId, ...(input.loopRunId ? [input.loopRunId] : [])],
      p_memory_gate: { useful: true, reliable: false, reproducible: false, generalizable: false, obsolete: false, evidence_required: true },
    });
    if (skillError) throw new Error(skillError.message);
    candidateSkillId = skillId as string;
  }
  return { learningId: data.id as string, candidateSkillId, diagnosis };
}
