import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getAdminContext } from "@/lib/auth/admin";
import { assessActivationHealth } from "@/lib/lia/activation-health";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  const { user, isAdmin } = await getAdminContext(supabase);
  if (!user || !isAdmin) return NextResponse.json({ error: "Accès administrateur requis." }, { status: 403 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "admin_client_not_configured" }, { status: 503 });
  const { data: skills, error: skillError } = await admin.from("lia_skills").select("id,slug,name,status,trust_score,active_version_id,updated_at").eq("status", "active").not("active_version_id", "is", null).order("updated_at", { ascending: false }).limit(100);
  if (skillError) return NextResponse.json({ error: "activation_health_unavailable" }, { status: 500 });
  const now = Date.now();
  const since = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const recentSince = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const items = [];
  for (const skill of skills ?? []) {
    const { data: events, error } = await admin.from("lia_skill_events").select("event,created_at,skill_version_id").eq("skill_id", skill.id).eq("skill_version_id", skill.active_version_id).in("event", ["succeeded", "failed"]).gte("created_at", since).order("created_at", { ascending: false }).limit(500);
    if (error) continue;
    const rows = events ?? [];
    const successes = rows.filter((r) => r.event === "succeeded").length;
    const failures = rows.filter((r) => r.event === "failed").length;
    const recentFailures = rows.filter((r) => r.event === "failed" && new Date(r.created_at).getTime() >= new Date(recentSince).getTime()).length;
    const health = assessActivationHealth({ active: true, sampleSize: rows.length, successes, failures, recentFailures });
    items.push({ skillId: skill.id, slug: skill.slug, name: skill.name, trustScore: skill.trust_score, activeVersionId: skill.active_version_id, updatedAt: skill.updated_at, health });
  }
  return NextResponse.json({ generatedAt: new Date().toISOString(), observationWindowDays: 30, recentWindowDays: 7, items, automaticRollbackAllowed: false });
}
