import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getAdminContext } from "@/lib/auth/admin";
import { assertSameOrigin } from "@/lib/security/csrf";

export async function GET() {
  try {
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
    const { user, isAdmin } = await getAdminContext(supabase);
    if (!user || !isAdmin) return NextResponse.json({ error: "Accès administrateur requis." }, { status: 403 });
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Secret serveur non configuré." }, { status: 503 });
    const monthStart = new Date(); monthStart.setUTCDate(1); const month = monthStart.toISOString().slice(0, 10);
    const [knowledge, skills, research, providerUsage] = await Promise.all([
      admin.from("financial_knowledge_items").select("id,knowledge_key,title,statement,authority,confidence,status,tags,created_at,updated_at").order("updated_at", { ascending: false }).limit(80),
      admin.from("lia_skills").select("id,name,slug,description,category,status,source_type,trust_score,use_count,success_count,failure_count,updated_at").order("updated_at", { ascending: false }).limit(80),
      admin.from("lia_research_runs").select("id,query,minimum_evidence_met,knowledge_graph_ready,created_at").order("created_at", { ascending: false }).limit(30),
      admin.from("lia_research_provider_usage").select("provider,operation,credits,created_at").eq("provider","tavily").gte("created_at", monthStart.toISOString()).order("created_at", { ascending: false }).limit(1000),
    ]);
    const error = knowledge.error || skills.error || research.error || providerUsage.error;
    if (error) return NextResponse.json({ error: error.message }, { status: 503 });
    const usageRows = providerUsage.data ?? [];
    const monthlyCredits = Number(process.env.TAVILY_MONTHLY_CREDITS || 1000);
    const guardPercent = Number(process.env.TAVILY_USAGE_GUARD_PERCENT || 90);
    const guardLimit = Math.max(1, Math.floor(monthlyCredits * Math.min(100, Math.max(1, guardPercent)) / 100));
    const usedCredits = usageRows.reduce((sum: number, row: any) => sum + Number(row.credits ?? 0), 0);
    return NextResponse.json({ knowledge: knowledge.data ?? [], skills: skills.data ?? [], research: research.data ?? [], researchBudget: { provider: "tavily", monthStart: month, monthlyCredits, guardPercent, guardLimit, usedCredits, searchCount: usageRows.length, remainingCredits: Math.max(0, guardLimit - usedCredits) } }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[admin/veille] GET failed", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Impossible de charger la veille." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête refusée." }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  const { user, isAdmin } = await getAdminContext(supabase);
  if (!user || !isAdmin) return NextResponse.json({ error: "Accès administrateur requis." }, { status: 403 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Secret serveur non configuré." }, { status: 503 });
  const body = await request.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";
  try {
    if (action === "validate_knowledge") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) return NextResponse.json({ error: "id requis." }, { status: 400 });
      const { data, error } = await admin.rpc("lia_admin_validate_financial_knowledge", { p_knowledge_id: id });
      if (error) return NextResponse.json({ error: error.message }, { status: 409 });
      return NextResponse.json({ ok: true, result: data });
    }
    if (action === "archive_knowledge") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) return NextResponse.json({ error: "id requis." }, { status: 400 });
      const { data, error } = await admin.from("financial_knowledge_items").update({ status: "deprecated", updated_at: new Date().toISOString() }).eq("id", id).select("id,status").single();
      if (error || !data) return NextResponse.json({ error: error?.message || "Connaissance non trouvée." }, { status: 409 });
      return NextResponse.json({ ok: true, item: data });
    }
    if (action === "validate_skill") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) return NextResponse.json({ error: "id requis." }, { status: 400 });
      const { data, error } = await admin.rpc("lia_validate_skill", { p_skill_id: id, p_actor: "admin" });
      if (error) return NextResponse.json({ error: error.message }, { status: 409 });
      return NextResponse.json({ ok: true, result: data });
    }
    if (action === "activate_skill") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) return NextResponse.json({ error: "id requis." }, { status: 400 });
      const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 2000) : "Activation administrateur après validation et promotion gouvernée.";
      if (reason.length < 10) return NextResponse.json({ error: "Une justification d’activation d’au moins 10 caractères est requise." }, { status: 400 });
      const { data, error } = await admin.rpc("lia_governed_activate_skill", { p_skill_id: id, p_actor: user.id, p_reason: reason });
      if (error) return NextResponse.json({ error: error.message }, { status: 409 });
      return NextResponse.json({ ok: true, result: data });
    }
    return NextResponse.json({ error: "Action Veille non autorisée." }, { status: 400 });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Action Veille impossible." }, { status: 503 }); }
}
