export type ProductionTelemetryInput = {
  skillId: string;
  skillVersionId?: string | null;
  userId: string;
  loopRunId?: string | null;
  qualityScore: number;
  verdict: "accepted" | "corrected" | "blocked";
  corrected: boolean;
  recommendationGenerated: boolean;
  humanApprovalRequired: boolean;
  evidenceCount?: number;
  provider?: string | null;
  model?: string | null;
  latencyMs?: number | null;
  inputChars?: number | null;
  outputChars?: number | null;
  generatedTokens?: number | null;
  tokensPerSecond?: number | null;
  estimatedCostCents?: number | null;
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(Number.isFinite(n) ? n : 0)));

/** Privacy-minimized production observation. It records metrics, never raw prompts/responses. */
export function normalizeProductionTelemetry(input: ProductionTelemetryInput) {
  return {
    skillId: input.skillId,
    skillVersionId: input.skillVersionId ?? null,
    userId: input.userId,
    loopRunId: input.loopRunId ?? null,
    qualityScore: clamp(input.qualityScore),
    verdict: input.verdict,
    corrected: Boolean(input.corrected),
    recommendationGenerated: Boolean(input.recommendationGenerated),
    humanApprovalRequired: Boolean(input.humanApprovalRequired),
    evidenceCount: Math.max(0, Math.min(100, Math.round(input.evidenceCount ?? 0))),
    provider: input.provider ? String(input.provider).slice(0, 32) : null,
    model: input.model ? String(input.model).slice(0, 128) : null,
    latencyMs: input.latencyMs == null ? null : Math.max(0, Math.round(input.latencyMs)),
    inputChars: input.inputChars == null ? null : Math.max(0, Math.min(2000000, Math.round(input.inputChars))),
    outputChars: input.outputChars == null ? null : Math.max(0, Math.min(2000000, Math.round(input.outputChars))),
    generatedTokens: input.generatedTokens == null ? null : Math.max(0, Math.min(1000000, Math.round(input.generatedTokens))),
    tokensPerSecond: input.tokensPerSecond == null ? null : Math.max(0, Math.min(100000, Number(input.tokensPerSecond))),
    estimatedCostCents: input.estimatedCostCents == null ? null : Math.max(0, Math.min(100000, Number(input.estimatedCostCents))),
  } as const;
}

export function summarizeProductionTelemetry(rows: Array<ReturnType<typeof normalizeProductionTelemetry>>) {
  const sampleSize = rows.length;
  const corrected = rows.filter((r) => r.corrected).length;
  const blocked = rows.filter((r) => r.verdict === "blocked").length;
  const recommendations = rows.filter((r) => r.recommendationGenerated).length;
  const qualityTotal = rows.reduce((sum, r) => sum + r.qualityScore, 0);
  const recommendationQuality = recommendations
    ? rows.filter((r) => r.recommendationGenerated).reduce((sum, r) => sum + r.qualityScore, 0) / recommendations
    : null;
  return {
    sampleSize,
    averageQualityScore: sampleSize ? Math.round(qualityTotal / sampleSize * 10) / 10 : null,
    correctionRate: sampleSize ? Math.round(corrected / sampleSize * 1000) / 10 : null,
    blockedRate: sampleSize ? Math.round(blocked / sampleSize * 1000) / 10 : null,
    recommendationCount: recommendations,
    recommendationRate: sampleSize ? Math.round(recommendations / sampleSize * 1000) / 10 : null,
    recommendationAverageQuality: recommendationQuality === null ? null : Math.round(recommendationQuality * 10) / 10,
    productionLearningAllowed: false,
    automaticPromotionAllowed: false,
    automaticActivationAllowed: false,
    automaticRollbackAllowed: false,
  } as const;
}
