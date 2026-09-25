export type SkillReleaseGateInput = {
  baselineScore: number;
  candidateScore: number;
  regressions: string[];
  criticalFailure: boolean;
  replayEligibleForReview: boolean;
  sandboxVerified: boolean;
};

export type SkillReleaseGate = {
  eligibleForHumanReview: boolean;
  canaryAllowed: false;
  automaticReleaseAllowed: false;
  reasons: string[];
};

const score = (value: number) => Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));

export function evaluateSkillReleaseGate(input: SkillReleaseGateInput): SkillReleaseGate {
  const reasons: string[] = [];
  const baselineScore = score(input.baselineScore);
  const candidateScore = score(input.candidateScore);

  if (!input.replayEligibleForReview) reasons.push("replay_not_eligible");
  if (input.criticalFailure) reasons.push("critical_failure");
  if (input.regressions.length > 0) reasons.push("regressions_present");
  if (candidateScore < baselineScore) reasons.push("candidate_below_baseline");
  if (!input.sandboxVerified) reasons.push("sandbox_not_verified");

  return {
    eligibleForHumanReview: reasons.length === 0,
    canaryAllowed: false,
    automaticReleaseAllowed: false,
    reasons,
  };
}

export function buildSkillReleaseEvidence(input: SkillReleaseGateInput) {
  const gate = evaluateSkillReleaseGate(input);
  return {
    eligible_for_review: gate.eligibleForHumanReview,
    critical_failure: input.criticalFailure,
    sandbox_verified: input.sandboxVerified,
    baseline_score: score(input.baselineScore),
    candidate_score: score(input.candidateScore),
    score_delta: score(input.candidateScore) - score(input.baselineScore),
    regressions: input.regressions.slice(0, 50),
    activation_allowed: false,
    automatic_release_allowed: false,
    reasons: gate.reasons,
  };
}
