import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin";
import { assertSameOrigin } from "@/lib/security/csrf";
import { normalizeLearningReviewDecision, decisionToStatus } from "@/lib/lia/learning-review-board";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  try {
    await requireAdmin(supabase);
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "admin_client_not_configured" }, { status: 503 });
    const { data, error } = await admin.from("lia_learning_review_board")
      .select("id,skill_id,skill_version_id,replay_run_id,title,category,verdict,baseline_score,candidate_score,score_delta,regressions,status,review_note,reviewed_by,reviewed_at,authority,created_at")
      .order("created_at", { ascending: false }).limit(200);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Accès administrateur requis.";
    return NextResponse.json({ error: message }, { status: message.includes("Accès administrateur") ? 403 : 500 });
  }
}

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "forbidden" }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  try {
    await requireAdmin(supabase);
    const body = await request.json().catch(() => null);
    if (!body || typeof body.id !== "string" || !["approve", "reject", "request_replay"].includes(body.decision)) {
      return NextResponse.json({ error: "invalid_review_decision" }, { status: 400 });
    }
    const decision = normalizeLearningReviewDecision({ decision: body.decision, note: body.note });
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "admin_client_not_configured" }, { status: 503 });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await admin.from("lia_learning_review_board")
      .update({ status: decisionToStatus(decision.decision), review_note: decision.note || null, reviewed_by: user.id, reviewed_at: new Date().toISOString(), authority: decision.authority })
      .eq("id", body.id).eq("status", "pending").select("id,status,review_note,reviewed_by,reviewed_at,authority").single();
    if (error) return NextResponse.json({ error: "review_update_failed", detail: error.message }, { status: 500 });
    return NextResponse.json({ item: data, activationAllowed: false, authority: decision.authority });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Accès administrateur requis.";
    return NextResponse.json({ error: message }, { status: message.includes("Accès administrateur") ? 403 : 500 });
  }
}
