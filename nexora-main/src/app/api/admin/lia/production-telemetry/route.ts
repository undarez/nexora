import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getAdminContext } from "@/lib/auth/admin";
import { summarizeProductionTelemetry } from "@/lib/lia/production-telemetry";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  const { user, isAdmin } = await getAdminContext(supabase);
  if (!user || !isAdmin) return NextResponse.json({ error: "Accès administrateur requis." }, { status: 403 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "admin_client_not_configured" }, { status: 503 });
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows, error } = await admin.from("lia_production_telemetry")
    .select("skill_id,skill_version_id,quality_score,verdict,corrected,recommendation_generated,human_approval_required,evidence_count,created_at")
    .gte("created_at", since).order("created_at", { ascending: false }).limit(2000);
  if (error) return NextResponse.json({ error: "production_telemetry_unavailable" }, { status: 500 });
  const normalized = (rows ?? []).map((r) => ({
    skillId: r.skill_id, skillVersionId: r.skill_version_id, userId: "admin-view", loopRunId: null,
    qualityScore: r.quality_score, verdict: r.verdict, corrected: r.corrected,
    recommendationGenerated: r.recommendation_generated, humanApprovalRequired: r.human_approval_required,
    evidenceCount: r.evidence_count,
  })) as Parameters<typeof summarizeProductionTelemetry>[0];
  const summary = summarizeProductionTelemetry(normalized);
  const bySkill = new Map<string, typeof normalized>();
  for (const row of normalized) bySkill.set(row.skillId, [...(bySkill.get(row.skillId) ?? []), row]);
  const skills = [...bySkill.entries()].map(([skillId, skillRows]) => ({ skillId, summary: summarizeProductionTelemetry(skillRows) }));
  return NextResponse.json({ generatedAt: new Date().toISOString(), observationWindowDays: 30, summary, skills });
}
