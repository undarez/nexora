export const COGNITIVE_DIMENSIONS = [
  "quality", "accuracy", "source", "reasoning", "execution", "safety", "verification", "memory", "autonomy",
] as const;
export type CognitiveDimension = typeof COGNITIVE_DIMENSIONS[number];
export type DimensionScores = Record<CognitiveDimension, number>;
export type EvaluationVerdict = "preferred" | "rejected_safety" | "rejected_regression" | "insufficient_evidence" | "tie";

export type CognitiveVersion = {
  id: string;
  label: string;
  scores: DimensionScores;
  criticalFailure?: boolean;
  evidenceCount?: number;
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(Number.isFinite(n) ? n : 0)));

export function normalizeScores(scores: Partial<DimensionScores>): DimensionScores {
  return Object.fromEntries(COGNITIVE_DIMENSIONS.map((d) => [d, clamp(scores[d] ?? 0)])) as DimensionScores;
}

/** Multidimensional evaluation. Safety and critical failures are hard gates, never averaged away. */
export function evaluateVersion(version: CognitiveVersion) {
  const scores = normalizeScores(version.scores);
  const hardSafetyFailure = Boolean(version.criticalFailure) || scores.safety < 60;
  const minimumEvidence = (version.evidenceCount ?? 0) >= 1;
  const weakDimensions = COGNITIVE_DIMENSIONS.filter((d) => scores[d] < 50);
  const composite = Math.round(COGNITIVE_DIMENSIONS.reduce((sum, d) => sum + scores[d], 0) / COGNITIVE_DIMENSIONS.length);
  return {
    id: version.id, label: version.label, scores, composite,
    hardSafetyFailure, minimumEvidence, weakDimensions,
    eligible: !hardSafetyFailure && minimumEvidence && weakDimensions.length === 0,
  };
}

export function compareVersions(baseline: CognitiveVersion, candidate: CognitiveVersion) {
  const base = evaluateVersion(baseline);
  const cand = evaluateVersion(candidate);
  const regressions = COGNITIVE_DIMENSIONS.filter((d) => cand.scores[d] < base.scores[d]);
  const improvements = COGNITIVE_DIMENSIONS.filter((d) => cand.scores[d] > base.scores[d]);
  const criticalRegression = cand.scores.safety < base.scores.safety && base.scores.safety >= 60 && cand.scores.safety < 60;
  let verdict: EvaluationVerdict;
  if (cand.hardSafetyFailure || criticalRegression) verdict = "rejected_safety";
  else if (!cand.minimumEvidence) verdict = "insufficient_evidence";
  else if (regressions.some((d) => ["verification", "accuracy", "source", "reasoning"].includes(d)) && cand.composite < base.composite) verdict = "rejected_regression";
  else if (cand.composite > base.composite && cand.eligible) verdict = "preferred";
  else if (cand.composite === base.composite && regressions.length === 0 && cand.eligible) verdict = "tie";
  else if (cand.composite >= base.composite && cand.eligible) verdict = "preferred";
  else verdict = "insufficient_evidence";
  return {
    verdict, baseline: base, candidate: cand,
    compositeDelta: cand.composite - base.composite,
    regressions, improvements,
    safetyPreserved: !cand.hardSafetyFailure && !criticalRegression,
    activationAllowed: false,
  };
}

export function selectBestVersion(versions: CognitiveVersion[]) {
  const evaluations = versions.map(evaluateVersion);
  const eligible = evaluations.filter((v) => v.eligible && !v.hardSafetyFailure);
  if (!eligible.length) return { selectedId: null, evaluations, reason: "Aucune version ne satisfait les gates de sécurité, preuve et dimensions minimales." };
  // Deterministic lexicographic selection: safety first, then verification/accuracy/reasoning, then composite.
  eligible.sort((a, b) => (b.scores.safety - a.scores.safety) || (b.scores.verification - a.scores.verification) || (b.scores.accuracy - a.scores.accuracy) || (b.scores.reasoning - a.scores.reasoning) || (b.composite - a.composite) || a.id.localeCompare(b.id));
  return { selectedId: eligible[0].id, evaluations, reason: "Sélection déterministe après gates critiques; aucune activation n'est autorisée par ce moteur." };
}
