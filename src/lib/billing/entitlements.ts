import type { SupabaseClient } from "@supabase/supabase-js";

export type NexoraPlan = "free" | "premium";
export const PREMIUM_PRICE_MONTHLY_EUR = 7.99;
export const PREMIUM_PRICE_YEARLY_EUR = 79.90;
export const PLAN_FEATURES = {
  free: ["Comptes manuels et suivi du budget", "Transactions du mois et catégorisation automatique", "Connexion bancaire avec synchronisation standard", "Prévisions et objectifs essentiels"],
  premium: ["Tout le plan Gratuit", "LIA financière avancée et analyses approfondies", "Historique bancaire étendu et analyses de tendances", "Autopilot, alertes intelligentes et détection avancée", "Cockpit Entreprise selon éligibilité", "Priorité sur les nouvelles fonctionnalités premium"],
} as const;
function isAdminEmail(email?: string | null) {
  const normalized = String(email ?? "").trim().toLowerCase();
  return normalized.length > 0 && (process.env.ADMIN_EMAILS ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean).includes(normalized);
}
export async function resolveEntitlement({ supabase, admin, userId, email }: { supabase: SupabaseClient; admin?: SupabaseClient | null; userId: string; email?: string | null }) {
  if (isAdminEmail(email)) return { plan: "premium" as const, isAdmin: true, premiumFree: true, status: "admin" };
  const client = admin ?? supabase;
  const { data } = await client.from("billing_subscriptions").select("status,current_period_end,cancel_at_period_end,stripe_price_id").eq("user_id", userId).maybeSingle();
  const active = ["active", "trialing", "past_due"].includes(String(data?.status ?? ""));
  return { plan: active ? "premium" as const : "free" as const, isAdmin: false, premiumFree: false, status: String(data?.status ?? "free"), currentPeriodEnd: data?.current_period_end ?? null, cancelAtPeriodEnd: Boolean(data?.cancel_at_period_end), priceId: data?.stripe_price_id ?? null };
}
