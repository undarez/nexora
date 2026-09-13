import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { buildImprovementReport } from "@/lib/lia/regression-engine";

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "forbidden" }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.candidateContent !== "string" || typeof body.baselineContent !== "string") return NextResponse.json({ error: "invalid_improvement_input" }, { status: 400 });
  const report = buildImprovementReport({ baselineContent: body.baselineContent, candidateContent: body.candidateContent });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return NextResponse.json({ report }, { status: 200 });
  const admin = createAdminClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await admin.from("lia_improvement_runs").insert({ user_id: user.id, candidate_skill_id: typeof body.candidateSkillId === "string" ? body.candidateSkillId : null, baseline: report.baseline, candidate: report.candidate, comparison: report.comparison, eligible_for_human_review: report.eligibleForHumanReview });
  if (error) return NextResponse.json({ error: "improvement_persistence_failed", detail: error.message, report }, { status: 500 });
  return NextResponse.json({ status: "candidate_review", ...report }, { status: 200 });
}
