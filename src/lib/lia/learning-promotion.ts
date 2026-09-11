export type LearningPromotionDecision = "promote" | "block";

export type LearningPromotionInput = {
  reviewStatus: "pending" | "approved" | "rejected" | "replay_requested" | "promoted" | "promotion_blocked";
  verdict: "improved" | "no_regression" | "regression" | "insufficient_evidence";
  candidateScore: number;
  regressions: string[];
  memoryGate: {
    useful?: boolean;
    reliable?: boolean;
    reproducible?: boolean;
    generalizable?: boolean;
    obsolete?: boolean;
  };
};

/**
 * Final pre-validation gate for a reviewed learning candidate.
 * This promotes a skill only to `validated`; activation remains a separate control-plane action.
 */
export function assessLearningPromotion(input: LearningPromotionInput) {
  const reasons: string[] = [];
  if (input.reviewStatus !== "approved") reasons.push("human_review_not_approved");
  if (!["improved", "no_regression"].includes(input.verdict)) reasons.push("replay_verdict_not_promotable");
  if (input.candidateScore < 80) reasons.push("candidate_score_below_threshold");
  if (input.regressions.length > 0) reasons.push("regressions_present");
  if (input.memoryGate.useful !== true) reasons.push("memory_gate_useful_failed");
  if (input.memoryGate.reliable !== true) reasons.push("memory_gate_reliable_failed");
  if (input.memoryGate.reproducible !== true) reasons.push("memory_gate_reproducible_failed");
  if (input.memoryGate.obsolete === true) reasons.push("candidate_marked_obsolete");

  return {
    eligible: reasons.length === 0,
    reasons,
    authority: {
      skillStatusUpdate: reasons.length === 0,
      skillActivation: false,
      modelWeightUpdate: false,
      policyUpdate: false,
      financialFactUpdate: false,
      permissionUpdate: false,
    },
  } as const;
}

export function promotionResponse(input: { promoted: boolean; skillId?: string | null; reasons?: string[] }) {
  return {
    promoted: input.promoted,
    skillId: input.skillId ?? null,
    status: input.promoted ? "validated" : "promotion_blocked",
    activationAllowed: false,
    reasons: input.reasons ?? [],
    authority: {
      skillActivation: false,
      modelWeightUpdate: false,
      policyUpdate: false,
      financialFactUpdate: false,
      permissionUpdate: false,
    },
  } as const;
}
