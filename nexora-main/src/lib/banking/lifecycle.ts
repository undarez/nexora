import type { SupabaseClient } from "@supabase/supabase-js";

export const RECONNECT_WINDOW_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export function addReconnectWindow(fromIso: string | Date = new Date()) {
  const from = fromIso instanceof Date ? fromIso.getTime() : Date.parse(fromIso);
  const base = Number.isFinite(from) ? from : Date.now();
  return new Date(base + RECONNECT_WINDOW_DAYS * DAY_MS).toISOString();
}

export function isDue(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return false;
  const value = Date.parse(iso);
  return Number.isFinite(value) && value <= now;
}

/**
 * NEXORA product policy: an authorization is valid for at most 90 calendar days
 * even when the provider reports a longer consent lifetime.
 */
export async function enforceReconnectDeadline({
  supabase,
  userId,
  connectionId,
  status,
  reconnectDueAt,
  consentExpiresAt,
}: {
  supabase: SupabaseClient;
  userId: string;
  connectionId: string;
  status: string;
  reconnectDueAt?: string | null;
  consentExpiresAt?: string | null;
}) {
  if (["revoked", "disconnected"].includes(status)) return { blocked: true as const, reason: "connection_inactive" as const };
  if (status === "needs_reauth") return { blocked: true as const, reason: "reconnect_required" as const };

  const now = Date.now();
  if (isDue(reconnectDueAt, now)) {
    await supabase.from("bank_connections").update({
      status: "needs_reauth",
      error_code: "RECONNECT_90D_REQUIRED",
      error_message: "Une reconnexion bancaire est requise après 90 jours.",
      updated_at: new Date().toISOString(),
    }).eq("id", connectionId).eq("user_id", userId);
    return { blocked: true as const, reason: "reconnect_90d_required" as const };
  }

  if (isDue(consentExpiresAt, now)) {
    await supabase.from("bank_connections").update({
      status: "needs_reauth",
      error_code: "CONSENT_EXPIRED",
      error_message: "Le consentement Open Banking a expiré.",
      updated_at: new Date().toISOString(),
    }).eq("id", connectionId).eq("user_id", userId);
    return { blocked: true as const, reason: "consent_expired" as const };
  }

  return { blocked: false as const };
}
