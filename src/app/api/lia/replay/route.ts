import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { buildReplayReport, type ReplayScenario } from "@/lib/lia/replay-harness";

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "forbidden" }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.candidateContent !== "string" || typeof body.baselineContent !== "string") return NextResponse.json({ error: "invalid_replay_input" }, { status: 400 });
  const scenarios = Array.isArray(body.scenarios) ? body.scenarios.filter((s: unknown): s is ReplayScenario => !!s && typeof s === "object" && typeof (s as ReplayScenario).id === "string" && typeof (s as ReplayScenario).name === "string" && Array.isArray((s as ReplayScenario).expectedCaseIds)).slice(0, 20) : undefined;
  const report = buildReplayReport({ baselineContent: body.baselineContent, candidateContent: body.candidateContent, scenarios });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return NextResponse.json({ status: "candidate_review", ...report }, { status: 200 });
  const admin = createAdminClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: replayRow, error } = await admin.from("lia_replay_runs").insert({ user_id: user.id, candidate_skill_id: typeof body.candidateSkillId === "string" ? body.candidateSkillId : null, scenarios: report.scenarios, baseline: { score: report.baseline.score, passed: report.baseline.passed, total: report.baseline.total, criticalFailure: report.baseline.criticalFailure, fingerprint: report.baselineFingerprint }, candidate: { score: report.candidate.score, passed: report.candidate.passed, total: report.candidate.total, criticalFailure: report.candidate.criticalFailure, fingerprint: report.candidateFingerprint }, comparison: report.comparison, eligible_for_human_review: report.eligibleForReview }).select("id").single();
  if (error) return NextResponse.json({ error: "replay_persistence_failed", detail: error.message, report }, { status: 500 });
  if (report.eligibleForReview && typeof body.candidateSkillId === "string") {
    const { data: version } = await admin.from("lia_skill_versions").select("id,version").eq("skill_id", body.candidateSkillId).order("version", { ascending: false }).limit(1).maybeSingle();
    await admin.from("lia_learning_review_board").insert({ skill_id: body.candidateSkillId, skill_version_id: version?.id ?? null, replay_run_id: replayRow?.id ?? null, title: typeof body.candidateTitle === "string" ? body.candidateTitle.trim().slice(0, 180) : "Amélioration candidate LIA", category: typeof body.candidateCategory === "string" ? body.candidateCategory.trim().slice(0, 80) : "learning", verdict: report.comparison.verdict, baseline_score: report.comparison.baselineScore, candidate_score: report.comparison.candidateScore, score_delta: report.comparison.delta, regressions: report.comparison.regressions, status: "pending", authority: { modelWeightUpdate: false, policyUpdate: false, financialFactUpdate: false, permissionUpdate: false, skillActivation: false } });
  }
  return NextResponse.json({ status: "candidate_review", ...report }, { status: 200 });
}
