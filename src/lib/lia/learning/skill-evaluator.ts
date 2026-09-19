import type { SupabaseClient } from "@supabase/supabase-js";

type SkillRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  trust_score: number | null;
  use_count: number | null;
  success_count: number | null;
  failure_count: number | null;
  active_version_id: string | null;
};

function scoreSkill(skill: SkillRow) {
  const use = Math.max(0, Number(skill.use_count ?? 0));
  const success = Math.max(0, Number(skill.success_count ?? 0));
  const failure = Math.max(0, Number(skill.failure_count ?? 0));
  const trust = Math.max(0, Math.min(100, Number(skill.trust_score ?? 0)));
  const observed = success + failure;
  if (use === 0 && observed === 0) return { score: Math.round(trust * 0.7), verdict: "insufficient_evidence" as const, successRate: null, gaps: ["no_runtime_evidence"] };
  const successRate = observed > 0 ? success / observed : success / Math.max(use, 1);
  const failureRate = observed > 0 ? failure / observed : 0;
  const score = Math.max(0, Math.min(100, Math.round(trust * 0.55 + successRate * 35 + Math.min(use, 100) * 0.1)));
  const verdict = failureRate >= 0.25 || score < 65 ? "needs_review" as const : failureRate >= 0.10 || score < 80 ? "watch" as const : "healthy" as const;
  const gaps = [];
  if (use < 3) gaps.push("insufficient_runtime_sample");
  if (failureRate >= 0.10) gaps.push("failure_rate_above_watch_threshold");
  if (trust < 70) gaps.push("trust_score_below_activation_threshold");
  return { score, verdict, successRate, gaps };
}

export async function evaluateLiaSkills(admin: SupabaseClient, userId: string, learningCycleId?: string | null) {
  const { data, error } = await admin
    .from("lia_skills")
    .select("id,slug,name,status,trust_score,use_count,success_count,failure_count,active_version_id")
    .or("scope.eq.global,and(scope.eq.user,user_id.eq." + userId + ")")
    .in("status", ["active", "validated", "candidate"])
    .order("trust_score", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as SkillRow[];
  const evaluations = rows.map((skill) => {
    const result = scoreSkill(skill);
    return {
      user_id: userId,
      skill_id: skill.id,
      skill_version_id: skill.active_version_id,
      learning_cycle_id: learningCycleId ?? null,
      evaluation_type: "autonomous_runtime",
      use_count: Math.max(0, Number(skill.use_count ?? 0)),
      success_count: Math.max(0, Number(skill.success_count ?? 0)),
      failure_count: Math.max(0, Number(skill.failure_count ?? 0)),
      success_rate: result.successRate,
      score: result.score,
      verdict: result.verdict,
      regressions: result.verdict === "needs_review" ? ["runtime_quality_regression_risk"] : [],
      gaps: result.gaps,
      evidence: {
        skill: skill.slug,
        status: skill.status,
        trust_score: skill.trust_score,
        sample: { use_count: skill.use_count ?? 0, success_count: skill.success_count ?? 0, failure_count: skill.failure_count ?? 0 },
        governed: true,
        activation_allowed: false,
      },
      activation_allowed: false,
    };
  });

  if (evaluations.length) {
    const { error: insertError } = await admin.from("lia_skill_evaluations").insert(evaluations);
    if (insertError) throw new Error(insertError.message);
  }

  const needsReview = evaluations.filter((item) => item.verdict === "needs_review").map((item) => item.skill_id);
  const watch = evaluations.filter((item) => item.verdict === "watch").length;

  return {
    evaluated: evaluations.length,
    needsReview: needsReview.length,
    watch,
    healthy: evaluations.filter((item) => item.verdict === "healthy").length,
    insufficientEvidence: evaluations.filter((item) => item.verdict === "insufficient_evidence").length,
    activationAllowed: false,
  };
}
