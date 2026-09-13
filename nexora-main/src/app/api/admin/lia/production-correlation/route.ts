import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getAdminContext } from "@/lib/auth/admin";
import { correlateProductionLearning, type ActivationObservation, type ProductionObservation } from "@/lib/lia/production-correlation";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  const { user, isAdmin } = await getAdminContext(supabase);
  if (!user || !isAdmin) return NextResponse.json({ error: "Accès administrateur requis." }, { status: 403 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "admin_client_not_configured" }, { status: 503 });
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [telemetry, activations] = await Promise.all([
    admin.from("lia_production_telemetry").select("skill_id,skill_version_id,quality_score,verdict,corrected,recommendation_generated,evidence_count,created_at").gte("created_at", since).limit(5000),
    admin.from("lia_skill_activations").select("skill_id,version_id,previous_version_id,created_at,status").gte("created_at", new Date(Date.now() - 90 * 86400000).toISOString()).order("created_at", { ascending: false }).limit(1000),
  ]);
  if (telemetry.error || activations.error) return NextResponse.json({ error: "production_correlation_unavailable" }, { status: 500 });
  const observations: ProductionObservation[] = (telemetry.data ?? []).map(r => ({ skillId: r.skill_id, skillVersionId: r.skill_version_id, qualityScore: r.quality_score, verdict: r.verdict, corrected: r.corrected, recommendationGenerated: r.recommendation_generated, evidenceCount: r.evidence_count, createdAt: r.created_at }));
  const activationRows: ActivationObservation[] = (activations.data ?? []).map(r => ({ skillId: r.skill_id, versionId: r.version_id, previousVersionId: r.previous_version_id, createdAt: r.created_at, status: r.status }));
  return NextResponse.json({ observationWindowDays: 30, ...correlateProductionLearning(observations, activationRows) });
}
