import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin";
import { assertSameOrigin } from "@/lib/security/csrf";
import { promotionResponse } from "@/lib/lia/learning-promotion";

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "forbidden" }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  try {
    await requireAdmin(supabase);
    const body = await request.json().catch(() => null);
    if (!body || typeof body.reviewId !== "string") return NextResponse.json({ error: "invalid_promotion_request" }, { status: 400 });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "admin_client_not_configured" }, { status: 503 });
    const { data, error } = await admin.rpc("lia_promote_reviewed_skill", { p_review_id: body.reviewId, p_actor: user.id });
    if (error) return NextResponse.json({ error: "promotion_failed", detail: error.message }, { status: 500 });
    const result = data as { promoted?: boolean; skill_id?: string; reasons?: string[] };
    return NextResponse.json(promotionResponse({ promoted: result.promoted === true, skillId: result.skill_id ?? null, reasons: result.reasons ?? [] }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Accès administrateur requis.";
    return NextResponse.json({ error: message }, { status: message.includes("Accès administrateur") ? 403 : 500 });
  }
}
