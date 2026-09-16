import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { assertSameOrigin } from "@/lib/security/csrf";
import { getLiaRuntimeControls } from "@/lib/lia/runtime/controls";
import { runLiveResearch } from "@/lib/lia/research/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function jsonError(error: unknown, status: number, code: string) {
  const detail = error instanceof Error ? error.message : "unknown";
  return NextResponse.json({ error: code, detail }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return jsonError(e, 403, "forbidden"); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const controls = await getLiaRuntimeControls(supabase);
  if (!controls.ai_enabled) return NextResponse.json({ error: "lia_disabled", detail: "LIA est désactivée par l'administrateur." }, { status: 503 });
  if (!controls.web_research_enabled) return NextResponse.json({ error: "web_research_disabled", detail: "La recherche Internet est désactivée par l'administrateur." }, { status: 503 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.query !== "string" || !body.query.trim()) return NextResponse.json({ error: "query_required" }, { status: 400 });
  const query = body.query.trim().slice(0, 2000);
  const urls = Array.isArray(body.urls) ? body.urls.filter((x: unknown): x is string => typeof x === "string").map((x: string) => x.trim()).filter(Boolean).slice(0, 8) : [];
  const maxSources = typeof body.maxSources === "number" && Number.isFinite(body.maxSources) ? Math.max(1, Math.min(8, Math.floor(body.maxSources))) : 6;
  const timeoutMs = typeof body.timeoutMs === "number" && Number.isFinite(body.timeoutMs) ? Math.max(2000, Math.min(15000, Math.floor(body.timeoutMs))) : 10000;

  try {
    const result = await runLiveResearch({ query, urls, maxSources, timeoutMs, discover: body.discover !== false });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && secret) {
      const admin = createAdminClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
      const { error } = await admin.from("lia_research_runs").insert({ user_id: user.id, query: result.query, evidence: result.evidence, claims: result.claims, contradictions: result.contradictions, stale_evidence: result.staleEvidence, unknowns: result.unknowns, minimum_evidence_met: result.minimumEvidenceMet, knowledge_graph_ready: result.knowledgeGraphReady, activation_allowed: false });
      if (error) return NextResponse.json({ error: "research_persistence_failed", detail: error.message, result }, { status: 500, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ status: result.minimumEvidenceMet ? "research_verified" : "research_review", ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return jsonError(e, 502, "live_research_failed");
  }
}
