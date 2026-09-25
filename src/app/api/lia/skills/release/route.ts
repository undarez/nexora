import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertSameOrigin } from "@/lib/security/csrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = new Set(["start_canary", "release", "rollback", "reject"]);

export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (!csrf.ok) return NextResponse.json({ error: "Requête non autorisée." }, { status: 403 });

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  try {
    const body = await request.json();
    const candidateId = typeof body?.candidateId === "string" ? body.candidateId : "";
    const action = typeof body?.action === "string" ? body.action : "";
    const reason = typeof body?.reason === "string" ? body.reason.slice(0, 1000) : null;

    if (!candidateId || !ACTIONS.has(action)) {
      return NextResponse.json({ error: "candidateId et action sont requis." }, { status: 400 });
    }

    // The RPC is SECURITY DEFINER but requires auth.uid() and checks ownership.
    const { data, error } = await supabase.rpc("lia_skill_release_transition", {
      p_candidate_id: candidateId,
      p_action: action,
      p_reason: reason,
    });

    if (error) {
      const status = /authentication_required|not_found/i.test(error.message) ? 403 : 409;
      return NextResponse.json({ error: error.message }, { status });
    }

    // Record a server-side control-plane audit event as an additional trace.
    const admin = getSupabaseAdmin();
    if (admin) {
      await admin.from("lia_runtime_events").insert({
        user_id: user.id,
        runtime_type: "skill_release",
        event: `skill_release.${action}`,
        status: "completed",
        payload: { candidate_id: candidateId, action, result: data, human_actor: user.id },
      });
    }

    return NextResponse.json({ ok: true, result: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "skill_release_transition_failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "POST requis." }, { status: 405 });
}
