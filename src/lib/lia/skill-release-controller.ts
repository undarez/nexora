import type { SupabaseClient } from "@supabase/supabase-js";

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


export async function refreshSkillCanaryHealth(admin: SupabaseClient, candidateId: string) {
  const { data: candidate, error: candidateError } = await admin
    .from("lia_skill_release_candidates")
    .select("id,user_id,skill_id,status,baseline_score,candidate_score,gates")
    .eq("id", candidateId)
    .maybeSingle();
  if (candidateError || !candidate) return { ok: false, healthy: false, reason: "candidate_not_found" };
  if (candidate.status !== "canary") return { ok: false, healthy: false, reason: "candidate_not_in_canary" };

  const started = candidate.gates?.canary_started_at ?? null;
  const query = admin
    .from("lia_skill_evaluations")
    .select("score,verdict,regressions,use_count,created_at")
    .eq("skill_id", candidate.skill_id)
    .eq("user_id", candidate.user_id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (started) query.gte("created_at", String(started));

  const { data: evaluations, error } = await query;
  if (error) return { ok: false, healthy: false, reason: "canary_evaluation_query_failed" };

  const rows = evaluations ?? [];
  const uses = rows.reduce((sum, row) => sum + Math.max(0, Number(row.use_count ?? 0)), 0);
  const critical = rows.some((row) => Array.isArray(row.regressions) && row.regressions.some((item: unknown) => /security|permission|policy|financial/i.test(String(item))));
  const failed = rows.filter((row) => String(row.verdict) === "needs_review").length;
  const averageScore = rows.length ? Math.round(rows.reduce((sum, row) => sum + Number(row.score ?? 0), 0) / rows.length) : 0;
  const healthy = rows.length > 0 && uses >= 3 && !critical && failed === 0 && averageScore >= Number(candidate.baseline_score ?? 0);

  const gates = {
    ...(candidate.gates ?? {}),
    canary_healthy: healthy,
    canary_observations: rows.length,
    canary_uses: uses,
    canary_average_score: averageScore,
    canary_critical_failure: critical,
    canary_failed_evaluations: failed,
    canary_checked_at: new Date().toISOString(),
  };

  await admin.from("lia_skill_release_candidates").update({ gates, updated_at: new Date().toISOString() }).eq("id", candidate.id);
  await admin.from("lia_skill_release_events").insert({
    user_id: candidate.user_id,
    candidate_id: candidate.id,
    action: "review_started",
    actor_type: "system",
    reason: healthy ? "Canary health gate passed." : "Canary health gate not yet satisfied.",
    evidence: gates,
  });

  return { ok: true, healthy, gates };
}
