import { createHash } from "node:crypto";

export type LearningEvidenceInput = {
  skillId: string;
  skillVersionId: string;
  replay?: { verdict: string; baselineScore: number; candidateScore: number; regressions?: string[] } | null;
  review?: { status: string; reviewedBy?: string | null; reviewedAt?: string | null } | null;
  promotion?: { status: string; eligible?: boolean } | null;
  activation?: { status: string; activatedAt?: string | null; previousVersionId?: string | null } | null;
  health?: { status: string; sampleSize: number; failureRate?: number | null } | null;
  correlation?: { signal: string; confidence: string } | null;
};

export function buildLearningEvidencePack(input: LearningEvidenceInput) {
  const gates = {
    replay: !!input.replay && ["improved", "no_regression"].includes(input.replay.verdict) && (input.replay.regressions?.length ?? 0) === 0,
    humanReview: input.review?.status === "approved",
    promotion: input.promotion?.status === "validated" || input.promotion?.eligible === true,
    activation: input.activation?.status === "active",
    health: input.health?.status === "healthy" || input.health?.status === "insufficient_data",
    correlation: !input.correlation || input.correlation.signal !== "negative_signal",
  };
  const evidence = { replay: input.replay ?? null, review: input.review ?? null, promotion: input.promotion ?? null, activation: input.activation ?? null, health: input.health ?? null, correlation: input.correlation ?? null };
  const evidenceFingerprint = createHash("sha256").update(JSON.stringify(evidence), "utf8").digest("hex");
  return {
    skillId: input.skillId,
    skillVersionId: input.skillVersionId,
    generatedAt: new Date().toISOString(),
    gates,
    decision: Object.values(gates).every(Boolean) ? "evidence_sufficient_for_review" : "evidence_incomplete",
    evidenceFingerprint,
    rawContentStored: false,
    automaticPromotionAllowed: false,
    automaticActivationAllowed: false,
    automaticRollbackAllowed: false,
    modelWeightUpdateAllowed: false,
  } as const;
}
