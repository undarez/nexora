export type ActivationHealthInput = {
  active: boolean;
  sampleSize: number;
  successes: number;
  failures: number;
  recentFailures: number;
};

/** Deterministic post-activation health gate. It can recommend review/rollback, never execute it. */
export function assessActivationHealth(input: ActivationHealthInput) {
  const reasons: string[] = [];
  const failureRate = input.sampleSize > 0 ? input.failures / input.sampleSize : 0;
  const recentFailureRate = input.sampleSize > 0 ? input.recentFailures / input.sampleSize : 0;

  if (!input.active) reasons.push("skill_not_active");
  if (input.sampleSize === 0) reasons.push("insufficient_observation");

  let status: "healthy" | "watch" | "critical" | "insufficient_data" = "healthy";
  if (input.sampleSize === 0) status = "insufficient_data";
  else if (failureRate >= 0.4 || recentFailureRate >= 0.3) status = "critical";
  else if (failureRate >= 0.2 || recentFailureRate >= 0.2) status = "watch";

  const rollbackRecommended = status === "critical";
  if (rollbackRecommended) reasons.push("rollback_review_recommended");
  else if (status === "watch") reasons.push("human_review_recommended");

  return {
    status,
    sampleSize: input.sampleSize,
    successes: input.successes,
    failures: input.failures,
    failureRate: Math.round(failureRate * 1000) / 10,
    recentFailures: input.recentFailures,
    recentFailureRate: Math.round(recentFailureRate * 1000) / 10,
    rollbackRecommended,
    automaticRollbackAllowed: false,
    reasons,
    authority: {
      automaticRollback: false,
      skillActivation: false,
      skillDeactivation: false,
      modelWeightUpdate: false,
      policyUpdate: false,
      financialFactUpdate: false,
      permissionUpdate: false,
    },
  } as const;
}
