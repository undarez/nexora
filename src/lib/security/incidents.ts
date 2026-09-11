import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function recordSecurityIncident(input: {
  userId?: string | null;
  eventType: string;
  route?: string;
  severity: "high" | "critical";
  reason: string;
  metadata?: Record<string, unknown>;
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return false;
  try {
    const admin = createAdminClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await admin.from("security_incidents").insert({
      user_id: input.userId ?? null,
      event_type: input.eventType,
      route: input.route ?? null,
      severity: input.severity,
      reason: input.reason,
      metadata: input.metadata ?? {},
    });
    return !error;
  } catch {
    return false;
  }
}
