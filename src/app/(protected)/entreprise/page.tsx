import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EnterpriseDashboard } from "@/components/enterprise/enterprise-dashboard";
import { buildEnterpriseDashboardContext } from "@/lib/enterprise/dashboard-context";

export default async function EntreprisePage() {
  const supabase = await createClient();
  if (!supabase) redirect("/auth?reason=configuration");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?reason=auth_required");

  // Enterprise access is gated server-side: a business workspace must have a verified SIRET.
  // This prevents direct navigation to /entreprise from bypassing onboarding.
  let hasVerifiedSiret = false;
  try {
    const { data: memberships, error: membershipError } = await supabase
      .from("financial_workspace_members")
      .select("workspace_id, financial_workspaces!inner(id, workspace_type, status)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .eq("financial_workspaces.workspace_type", "business")
      .eq("financial_workspaces.status", "active")
      .limit(10);

    if (membershipError) throw membershipError;
    const workspaceIds = (memberships ?? []).map((row: any) => row.workspace_id).filter(Boolean);
    if (workspaceIds.length) {
      const { data: businessProfiles, error: profileError } = await supabase
        .from("business_profiles")
        .select("workspace_id, siret, verification_status")
        .in("workspace_id", workspaceIds);
      if (profileError) throw profileError;
      hasVerifiedSiret = (businessProfiles ?? []).some((profile: any) =>
        typeof profile.siret === "string" && /^\d{14}$/.test(profile.siret) && profile.verification_status === "verified"
      );
    }
  } catch (error) {
    console.error("[entreprise] access gate failed", error);
    return <main className="mx-auto max-w-4xl px-6 py-12"><div className="rounded-3xl border bg-card p-8"><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">NEXORA · Entreprise</p><h1 className="mt-2 text-3xl font-bold">Vérification entreprise indisponible</h1><p className="mt-3 text-sm text-muted-foreground">Impossible de vérifier le SIRET de l’espace entreprise. Réessaie après avoir vérifié la connexion Supabase.</p><pre className="mt-5 overflow-auto rounded-xl bg-muted p-4 text-xs">{error instanceof Error ? error.message : "Erreur inconnue"}</pre></div></main>;
  }

  if (!hasVerifiedSiret) redirect("/onboarding?type=business&reason=siret_required");

  try {
    const context = await buildEnterpriseDashboardContext({ supabase, userId: user.id });
    return <EnterpriseDashboard initial={context} />;
  } catch (error) {
    console.error("[entreprise] dashboard context failed", error);
    return <main className="mx-auto max-w-4xl px-6 py-12"><div className="rounded-3xl border bg-card p-8"><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">NEXORA · Entreprise</p><h1 className="mt-2 text-3xl font-bold">Données financières indisponibles</h1><p className="mt-3 text-sm text-muted-foreground">Le cockpit entreprise utilise le même socle financier que le tableau de bord particulier. Vérifie la connexion Supabase et réessaie.</p><pre className="mt-5 overflow-auto rounded-xl bg-muted p-4 text-xs">{error instanceof Error ? error.message : "Erreur inconnue"}</pre></div></main>;
  }
}
