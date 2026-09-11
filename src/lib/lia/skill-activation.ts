export type SkillActivationGateInput = {
  status: string;
  trustScore: number;
  memoryGate: { useful?: boolean; reliable?: boolean; reproducible?: boolean; obsolete?: boolean };
  hasGovernedPromotion: boolean;
};

/** Pure preflight for the final activation control-plane gate. */
export function assessSkillActivation(input: SkillActivationGateInput) {
  const reasons: string[] = [];
  if (input.status !== "validated") reasons.push("skill_not_validated");
  if (input.trustScore < 70) reasons.push("trust_score_below_threshold");
  if (input.memoryGate.useful !== true) reasons.push("memory_gate_useful_failed");
  if (input.memoryGate.reliable !== true) reasons.push("memory_gate_reliable_failed");
  if (input.memoryGate.reproducible !== true) reasons.push("memory_gate_reproducible_failed");
  if (input.memoryGate.obsolete === true) reasons.push("skill_marked_obsolete");
  if (!input.hasGovernedPromotion) reasons.push("governed_promotion_missing");
  return {
    eligible: reasons.length === 0,
    reasons,
    authority: { skillActivation: reasons.length === 0, modelWeightUpdate: false, policyUpdate: false, financialFactUpdate: false, permissionUpdate: false },
  } as const;
}

export function activationResponse(input: { activated: boolean; skillId?: string | null; version?: number | null; reasons?: string[]; rollback?: boolean }) {
  return {
    activated: input.activated,
    skillId: input.skillId ?? null,
    version: input.version ?? null,
    status: input.activated ? "active" : "activation_blocked",
    rollback: input.rollback === true,
    reasons: input.reasons ?? [],
    authority: { skillActivation: input.activated, modelWeightUpdate: false, policyUpdate: false, financialFactUpdate: false, permissionUpdate: false },
  } as const;
}
