import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizeSiret, isValidSiret } from "@/lib/business/siret";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase n'est pas configuré." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  const { data: membership, error } = await supabase
    .from("financial_workspace_members")
    .select("workspace_id, role, financial_workspaces!inner(id,name,workspace_type,status)")
    .eq("user_id", user.id).eq("status", "active")
    .eq("financial_workspaces.workspace_type", "business")
    .eq("financial_workspaces.status", "active").limit(1).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!membership) return NextResponse.json({ error: "Aucun espace Entreprise actif." }, { status: 404 });
  const { data: profile, error: profileError } = await supabase.from("business_profiles").select("*").eq("workspace_id", membership.workspace_id).maybeSingle();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  return NextResponse.json({ workspace: membership.financial_workspaces, role: membership.role, business: profile });
}

export async function PATCH(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête cross-origin refusée." }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase n'est pas configuré." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const requestedSiret = normalizeSiret(typeof body.siret === "string" ? body.siret : "");
  if (!isValidSiret(requestedSiret)) return NextResponse.json({ error: "Le SIRET doit contenir 14 chiffres et avoir une clé de contrôle valide." }, { status: 400 });
  return NextResponse.json({ error: "Le SIRET d'un espace Entreprise vérifié ne peut pas être modifié directement. Crée un nouvel espace avec le nouveau SIRET." }, { status: 409 });
}

export async function DELETE(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête cross-origin refusée." }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase n'est pas configuré." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Runtime serveur incomplet." }, { status: 503 });
  return NextResponse.json({ error: "La suppression d'un profil Entreprise doit passer par le flux de suppression de l'espace afin de préserver l'intégrité financière." }, { status: 409 });
}
