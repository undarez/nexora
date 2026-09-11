import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  try {
    await requireAdmin(supabase);
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "admin_client_not_configured" }, { status: 503 });
    const { data, error } = await admin.from("lia_learning_evidence_packs")
      .select("id,skill_id,skill_version_id,evidence_fingerprint,decision,gates,generated_at")
      .order("generated_at", { ascending: false }).limit(200);
    if (error) return NextResponse.json({ error: "learning_evidence_unavailable", detail: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [], rawContentStored: false, automaticDeploymentAllowed: false }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Accès administrateur requis.";
    return NextResponse.json({ error: message }, { status: message.includes("Accès administrateur") ? 403 : 500 });
  }
}
