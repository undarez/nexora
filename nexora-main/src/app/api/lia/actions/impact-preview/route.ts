import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { buildLiaImpactPreview } from "@/lib/lia/actions/impact-preview";

export async function GET(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Identifiant de proposition requis." }, { status: 400 });
  const { data: proposal, error } = await supabase.from("lia_action_proposals")
    .select("id,user_id,action_key,risk_class,reversible,payload,status,expires_at")
    .eq("id", id).eq("user_id", user.id).single();
  if (error || !proposal) return NextResponse.json({ error: "Proposition introuvable." }, { status: 404 });
  const preview = buildLiaImpactPreview({ actionKey: proposal.action_key, riskClass: proposal.risk_class, reversible: Boolean(proposal.reversible), payload: (proposal.payload ?? {}) as Record<string, unknown> });
  await supabase.from("lia_action_proposals").update({ impact_preview: preview, impact_previewed_at: preview.generatedAt }).eq("id", proposal.id).eq("user_id", user.id);
  return NextResponse.json({ proposal_id: proposal.id, status: proposal.status, expires_at: proposal.expires_at, preview });
}

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête refusée." }, { status: 403 }); }
  return GET(request);
}
