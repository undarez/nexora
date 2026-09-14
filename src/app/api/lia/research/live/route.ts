import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { assertSameOrigin } from "@/lib/security/csrf";
import { getLiaRuntimeControls } from "@/lib/lia/runtime/controls";
import { runLiveResearch } from "@/lib/lia/research/live";

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "forbidden" }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const controls = await getLiaRuntimeControls(supabase);
  if (!controls.ai_enabled) return NextResponse.json({ error: "lia_disabled", detail: "LIA est désactivée par l'administrateur." }, { status: 503 });
  if (!controls.web_research_enabled) return NextResponse.json({ error: "web_research_disabled", detail: "La recherche Internet est désactivée par l'administrateur." }, { status: 503 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.query !== "string" || !body.query.trim()) return NextResponse.json({ error: "query_required" }, { status: 400 });
  const urls = Array.isArray(body.urls) ? body.urls.filter((x: unknown): x is string => typeof x === "string") : [];

  try {
    const result = await runLiveResearch({ query: body.query, urls, maxSources: body.maxSources, timeoutMs: body.timeoutMs, discover: body.discover !== false });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && secret) {
      const admin = createAdminClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
      const { error } = await admin.from("lia_research_runs").insert({ user_id: user.id, query: result.query, evidence: result.evidence, claims: result.claims, contradictions: result.contradictions, stale_evidence: result.staleEvidence, unknowns: result.unknowns, minimum_evidence_met: result.minimumEvidenceMet, knowledge_graph_ready: result.knowledgeGraphReady, activation_allowed: false });
      if (error) return NextResponse.json({ error: "research_persistence_failed", detail: error.message, result }, { status: 500 });
    }
    return NextResponse.json({ status: result.minimumEvidenceMet ? "research_verified" : "research_review", ...result });
  } catch (e) {
    return NextResponse.json({ error: "live_research_failed", detail: e instanceof Error ? e.message : "unknown" }, { status: 502 });
  }
}
