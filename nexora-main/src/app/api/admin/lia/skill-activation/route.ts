import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getAdminContext } from "@/lib/auth/admin";
import { assertSameOrigin } from "@/lib/security/csrf";
import { activationResponse } from "@/lib/lia/skill-activation";

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "forbidden" }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  const { user, isAdmin } = await getAdminContext(supabase);
  if (!user || !isAdmin) return NextResponse.json({ error: "Accès administrateur requis." }, { status: 403 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "admin_client_not_configured" }, { status: 503 });
  const body = await request.json().catch(() => null);
  const skillId = typeof body?.skillId === "string" ? body.skillId : "";
  const action = typeof body?.action === "string" ? body.action : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 2000) : "";
  if (!skillId || !["activate", "rollback"].includes(action)) return NextResponse.json({ error: "invalid_activation_request" }, { status: 400 });
  if (reason.length < 10) return NextResponse.json({ error: action === "rollback" ? "rollback_reason_required" : "activation_reason_required" }, { status: 400 });
  const fn = action === "rollback" ? "lia_governed_rollback_skill" : "lia_governed_activate_skill";
  const { data, error } = await admin.rpc(fn, { p_skill_id: skillId, p_actor: user.id, p_reason: reason });
  if (error) return NextResponse.json({ error: "skill_activation_failed", detail: error.message }, { status: 409 });
  const result = data as { activated?: boolean; rollback?: boolean; skill_id?: string; version?: number; reasons?: string[] };
  return NextResponse.json(activationResponse({ activated: result.activated === true, rollback: result.rollback === true, skillId: result.skill_id, version: result.version, reasons: result.reasons }));
}
