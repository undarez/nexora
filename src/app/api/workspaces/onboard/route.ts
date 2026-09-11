import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isValidSiret, normalizeSiret } from "@/lib/business/siret";

const SEARCH_API = "https://recherche-entreprises.api.gouv.fr/search";
type Establishment = Record<string, unknown>;
type CompanyResult = Record<string, unknown> & { siege?: Establishment; matching_etablissements?: Establishment[] };
const pickText = (...values: unknown[]) => values.find((v) => typeof v === "string" && v.trim()) as string | undefined;
function pickEstablishment(company: CompanyResult, siret: string) { const matches = Array.isArray(company.matching_etablissements) ? company.matching_etablissements : []; return (matches.find((item) => String(item.siret || "") === siret) || company.siege || matches[0] || {}) as Establishment; }

async function verifySiret(siret: string) {
  const url = new URL(SEARCH_API); url.searchParams.set("q", siret); url.searchParams.set("per_page", "10"); url.searchParams.set("page", "1");
  const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw new Error(`SIRENE_HTTP_${response.status}`);
  const payload = await response.json() as { results?: CompanyResult[] };
  const companies = Array.isArray(payload.results) ? payload.results : [];
  const company = companies.find((item) => { const establishment = pickEstablishment(item, siret); return String(establishment.siret || "") === siret || String(item.siret_siege || "") === siret; });
  if (!company) return null;
  const establishment = pickEstablishment(company, siret);
  const status = pickText(establishment.etat_administratif, establishment.statut_entreprise, company.statut_entreprise);
  const normalizedStatus = status === "A" || status?.toLowerCase() === "active" ? "active" : status === "C" || status?.toLowerCase() === "closed" ? "closed" : "unknown";
  return {
    legalName: pickText(company.nom_raison_sociale, company.nom_complet) || "Entreprise", tradeName: pickText(company.nom_complet, company.sigle),
    siren: pickText(company.siren) || siret.slice(0, 9), siret: pickText(establishment.siret, company.siret_siege) || siret,
    legalForm: pickText(company.nature_juridique, company.forme_juridique), activityCode: pickText(establishment.activite_principale, company.activite_principale),
    activityLabel: pickText(establishment.libelle_activite_principale, company.libelle_activite_principale), addressLine: pickText(establishment.adresse, establishment.adresse_complete, establishment.geo_adresse),
    postalCode: pickText(establishment.code_postal), city: pickText(establishment.libelle_commune, establishment.ville, establishment.commune), status: normalizedStatus,
    snapshot: { company, establishment, source: SEARCH_API, verified_siret: siret },
  };
}

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête cross-origin refusée." }, { status: 403 }); }
  try {
    const supabase = await createClient(); if (!supabase) return NextResponse.json({ error: "Supabase n'est pas configuré." }, { status: 503 });
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const workspaceType = body.workspaceType === "business" ? "business" : body.workspaceType === "personal" ? "personal" : "";
    const requestedName = typeof body.name === "string" ? body.name.trim().slice(0, 160) : ""; const siret = normalizeSiret(typeof body.siret === "string" ? body.siret : "");
    if (!workspaceType) return NextResponse.json({ error: "Choisis un type d'espace." }, { status: 400 });
    const admin = getSupabaseAdmin(); if (!admin) return NextResponse.json({ error: "Runtime serveur incomplet : clé Supabase secrète manquante." }, { status: 503 });
    const { data: existing } = await admin.from("financial_workspace_members").select("workspace_id, financial_workspaces(id, workspace_type, name, status)").eq("user_id", user.id).eq("status", "active");
    const existingBusiness = (existing || []).find((item: any) => item.financial_workspaces?.workspace_type === "business" && item.financial_workspaces?.status === "active");
    const existingPersonal = (existing || []).find((item: any) => item.financial_workspaces?.workspace_type === "personal" && item.financial_workspaces?.status === "active");
    if (workspaceType === "business" && existingBusiness) {
      const { data: existingProfile } = await admin.from("business_profiles").select("siret, verification_status").eq("workspace_id", existingBusiness.workspace_id).maybeSingle();
      if (existingProfile?.siret && existingProfile.verification_status === "verified") {
        return NextResponse.json({ ok: true, workspace: existingBusiness.financial_workspaces, alreadyExists: true, business: { siret: existingProfile.siret, status: "active" } });
      }
      return NextResponse.json({ error: "Cet espace entreprise ne possède pas de SIRET vérifié. Une vérification est obligatoire avant tout accès entreprise." }, { status: 422 });
    }
    if (workspaceType === "personal" && existingPersonal) return NextResponse.json({ ok: true, workspace: existingPersonal.financial_workspaces, alreadyExists: true });
    let business: Awaited<ReturnType<typeof verifySiret>> = null;
    if (workspaceType === "business") {
      if (!isValidSiret(siret)) return NextResponse.json({ error: "Le SIRET doit contenir 14 chiffres et avoir une clé de contrôle valide." }, { status: 400 });
      try { business = await verifySiret(siret); } catch (error) { console.error("[enterprise][siret] lookup failed", error); return NextResponse.json({ error: "Le registre officiel des entreprises est momentanément indisponible. Réessaie dans quelques instants." }, { status: 503 }); }
      if (!business) return NextResponse.json({ error: "Ce SIRET n'a pas été retrouvé dans le registre officiel." }, { status: 422 });
      if (business.status === "closed") return NextResponse.json({ error: "Cet établissement est indiqué comme fermé dans le registre officiel." }, { status: 422 });
      if (business.status !== "active") return NextResponse.json({ error: "Le statut de cet établissement ne permet pas de créer un espace Entreprise." }, { status: 422 });
    }
    const workspaceName = workspaceType === "business" ? business?.legalName || requestedName || "Entreprise" : requestedName || "Mon espace personnel";
    const { data: workspace, error: workspaceError } = await admin.from("financial_workspaces").insert({ owner_user_id: user.id, workspace_type: workspaceType, name: workspaceName, status: "active" }).select("id, workspace_type, name, status, created_at").single();
    if (workspaceError || !workspace) { console.error("[enterprise][workspace] create failed", workspaceError); return NextResponse.json({ error: "Impossible de créer l'espace financier." }, { status: 500 }); }
    const { error: memberError } = await admin.from("financial_workspace_members").insert({ workspace_id: workspace.id, user_id: user.id, role: "owner", status: "active" });
    if (memberError) { await admin.from("financial_workspaces").delete().eq("id", workspace.id); console.error("[enterprise][member] create failed", memberError); return NextResponse.json({ error: "Impossible de finaliser l'espace financier." }, { status: 500 }); }
    if (business) {
      const { data: duplicateSiret } = await admin.from("business_profiles").select("workspace_id").eq("siret", business.siret).maybeSingle();
      if (duplicateSiret) {
        await admin.from("financial_workspace_members").delete().eq("workspace_id", workspace.id).eq("user_id", user.id);
        await admin.from("financial_workspaces").delete().eq("id", workspace.id);
        return NextResponse.json({ error: "Ce SIRET est déjà rattaché à un espace Entreprise dans NEXORA." }, { status: 409 });
      }
      const { error: profileError } = await admin.from("business_profiles").insert({ workspace_id: workspace.id, legal_name: business.legalName, trade_name: business.tradeName || null, siret: business.siret, siren: business.siren, legal_form: business.legalForm || null, activity_code: business.activityCode || null, activity_label: business.activityLabel || null, address_line: business.addressLine || null, postal_code: business.postalCode || null, city: business.city || null, country_code: "FR", verification_status: "verified", verification_source: "recherche-entreprises.api.gouv.fr", verified_at: new Date().toISOString(), sirene_snapshot: business.snapshot });
      if (profileError) { await admin.from("financial_workspace_members").delete().eq("workspace_id", workspace.id).eq("user_id", user.id); await admin.from("financial_workspaces").delete().eq("id", workspace.id); console.error("[enterprise][profile] create failed", profileError); return NextResponse.json({ error: "Impossible d'enregistrer le profil entreprise." }, { status: 500 }); }
    }
    return NextResponse.json({ ok: true, workspace, business: business ? { legalName: business.legalName, siret: business.siret, status: business.status } : null });
  } catch (error) { console.error("[enterprise][onboard] unexpected error", error); return NextResponse.json({ error: "Impossible de finaliser la configuration." }, { status: 500 }); }
}
