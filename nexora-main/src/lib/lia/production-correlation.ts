export type ProductionObservation = {
  skillId: string;
  skillVersionId: string | null;
  qualityScore: number;
  verdict: "accepted" | "corrected" | "blocked";
  corrected: boolean;
  recommendationGenerated: boolean;
  evidenceCount: number;
  createdAt: string;
};

export type ActivationObservation = {
  skillId: string;
  versionId: string;
  previousVersionId: string | null;
  createdAt: string;
  status: "active" | "rolled_back";
};

const pct = (n: number) => Math.round(n * 1000) / 10;

function metrics(rows: ProductionObservation[]) {
  const n = rows.length;
  if (!n) return null;
  const avg = rows.reduce((s, r) => s + r.qualityScore, 0) / n;
  const corrected = rows.filter(r => r.corrected).length / n;
  const blocked = rows.filter(r => r.verdict === "blocked").length / n;
  const recommendations = rows.filter(r => r.recommendationGenerated);
  const recQuality = recommendations.length ? recommendations.reduce((s, r) => s + r.qualityScore, 0) / recommendations.length : null;
  const evidence = rows.reduce((s, r) => s + r.evidenceCount, 0) / n;
  return { sampleSize: n, averageQualityScore: Math.round(avg * 10) / 10, correctionRate: pct(corrected), blockedRate: pct(blocked), recommendationRate: pct(recommendations.length / n), recommendationAverageQuality: recQuality === null ? null : Math.round(recQuality * 10) / 10, averageEvidenceCount: Math.round(evidence * 10) / 10 };
}

/**
 * Correlates production observations with the exact activated Skill version.
 * This is observational evidence, not causal attribution, and never changes state.
 */
export function correlateProductionLearning(observations: ProductionObservation[], activations: ActivationObservation[]) {
  const activationByVersion = new Map(activations.map(a => [a.versionId, a]));
  const grouped = new Map<string, ProductionObservation[]>();
  for (const row of observations) {
    if (!row.skillVersionId) continue;
    const key = `${row.skillId}:${row.skillVersionId}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  const bySkill = new Map<string, Array<Record<string, unknown>>>();
  const reports: Array<Record<string, unknown>> = [];
  for (const [key, rows] of grouped) {
    const [skillId, versionId] = key.split(":");
    const current = metrics(rows);
    if (!current) continue;
    const activation = activationByVersion.get(versionId) ?? null;
    const previousRows = activation?.previousVersionId ? grouped.get(`${skillId}:${activation.previousVersionId}`) ?? [] : [];
    const previous = metrics(previousRows);
    const qualityDelta = previous ? Math.round((current.averageQualityScore - previous.averageQualityScore) * 10) / 10 : null;
    const correctionDelta = previous ? Math.round((current.correctionRate - previous.correctionRate) * 10) / 10 : null;
    const blockedDelta = previous ? Math.round((current.blockedRate - previous.blockedRate) * 10) / 10 : null;
    const confidence = current.sampleSize >= 30 && (!previous || previous.sampleSize >= 30) ? "high" : current.sampleSize >= 10 && (!previous || previous.sampleSize >= 10) ? "medium" : "low";
    const signal = previous && current.sampleSize >= 5 && previous.sampleSize >= 5
      ? qualityDelta! >= 3 && blockedDelta! <= 0 && correctionDelta! <= 2 ? "positive_signal"
      : qualityDelta! <= -3 || blockedDelta! >= 5 ? "negative_signal" : "no_clear_signal"
      : "insufficient_baseline";
    const report = { skillId, skillVersionId: versionId, activatedAt: activation?.createdAt ?? null, previousVersionId: activation?.previousVersionId ?? null, current, previous, deltas: { qualityScore: qualityDelta, correctionRate: correctionDelta, blockedRate: blockedDelta }, signal, confidence, attribution: "observational_only", productionPromotionAllowed: false, automaticActivationAllowed: false, automaticRollbackAllowed: false };
    reports.push(report);
    const bucket = bySkill.get(skillId) ?? [];
    bucket.push(report);
    bySkill.set(skillId, bucket);
  }
  return { generatedAt: new Date().toISOString(), reports, skills: [...bySkill.entries()].map(([skillId, versions]) => ({ skillId, versions })), policy: { causalInference: false, automaticLearning: false, automaticPromotion: false, automaticActivation: false, automaticRollback: false } };
}
