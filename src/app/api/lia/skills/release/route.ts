import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertSameOrigin } from "@/lib/security/csrf";
import { requireAdmin } from "@/lib/auth/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = new Set(["start_canary", "release", "rollback", "reject"]);

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch { return NextResponse.json({ error: "Requête non autorisée." }, { status: 403 }); }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  try {
    const adminUser = await requireAdmin(supabase);
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase admin non configuré." }, { status: 503 });

    const body = await request.json();
    const candidateId = typeof body?.candidateId === "string" ? body.candidateId : "";
    const action = typeof body?.action === "string" ? body.action : "";
    const reason = typeof body?.reason === "string" ? body.reason.slice(0, 1000) : null;

    if (!candidateId || !ACTIONS.has(action)) {
      return NextResponse.json({ error: "candidateId et action sont requis." }, { status: 400 });
    }

    // Release/canary/rollback is a control-plane operation. The database RPC
    // is service-role-only; this route supplies the authenticated admin actor.
    const { data, error } = await admin.rpc("lia_skill_release_transition_admin", {
      p_candidate_id: candidateId,
      p_action: action,
      p_reason: reason,
      p_actor: adminUser.id,
    });

    if (error) {
      const status = /authentication_required|not_found|control_plane/i.test(error.message) ? 403 : 409;
      return NextResponse.json({ error: error.message }, { status });
    }

    // Record a server-side control-plane audit event as an additional trace.
    await admin.from("lia_runtime_events").insert({
      user_id: user.id,
      runtime_type: "skill_release",
      event: `skill_release.${action}`,
      status: "completed",
      payload: { candidate_id: candidateId, action, result: data, human_actor: user.id },
    });

    return NextResponse.json({ ok: true, result: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "skill_release_transition_failed" }, { status: 500 });
  }
}

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const { data, error } = await supabase
    .from("lia_skill_release_candidates")
    .select("id,skill_id,baseline_version_id,candidate_version_id,status,baseline_score,candidate_score,score_delta,regressions,gates,canary_started_at,canary_ends_at,released_at,rolled_back_at,created_at,updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ candidates: data ?? [] });
}
