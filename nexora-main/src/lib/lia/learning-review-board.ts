export type LearningReviewDecision = "approve" | "reject" | "request_replay";
export type LearningReviewStatus = "pending" | "approved" | "rejected" | "replay_requested";

export type LearningReviewCandidate = {
  skillId: string;
  skillVersionId?: string | null;
  replayRunId?: string | null;
  title: string;
  category: string;
  verdict: "improved" | "no_regression" | "regression" | "insufficient_evidence";
  baselineScore: number;
  candidateScore: number;
  scoreDelta: number;
  regressions: string[];
  eligibleForHumanReview: boolean;
};

/**
 * Control-plane boundary for LIA learning candidates.
 * A board decision records human review only; it never changes model weights,
 * financial facts, permissions, policy, or skill activation.
 */
export function normalizeLearningReviewDecision(input: {
  decision: LearningReviewDecision;
  note?: string;
}) {
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 2000) : "";
  return {
    decision: input.decision,
    note,
    authority: {
      modelWeightUpdate: false,
      policyUpdate: false,
      financialFactUpdate: false,
      permissionUpdate: false,
      skillActivation: false,
    },
  } as const;
}

export function canEnterReviewBoard(input: {
  verdict: LearningReviewCandidate["verdict"];
  candidateScore: number;
  criticalFailure?: boolean;
}) {
  return (input.verdict === "improved" || input.verdict === "no_regression")
    && input.candidateScore >= 80
    && !input.criticalFailure;
}

export function decisionToStatus(decision: LearningReviewDecision): LearningReviewStatus {
  if (decision === "approve") return "approved";
  if (decision === "reject") return "rejected";
  return "replay_requested";
}
