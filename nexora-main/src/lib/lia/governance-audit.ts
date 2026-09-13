/** V5.08.45 — tamper-evident governance audit facade. */
import type { SupabaseClient } from "@supabase/supabase-js";

export type LiaGovernanceAuditEvent = {
  eventType: string;
  actor: "user" | "lia" | "system";
  correlationId?: string | null;
  sourceRefs?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

const SENSITIVE = /(password|secret|token|authorization|cookie|iban|bic|card|provider_payload|access_token|refresh_token)/i;
function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.slice(0, 50).map(sanitize);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) if (!SENSITIVE.test(k)) out[k] = sanitize(v);
    return out;
  }
  return typeof value === "string" ? value.slice(0, 1000) : value;
}

export async function recordLiaGovernanceAudit(supabase: SupabaseClient, userId: string, event: LiaGovernanceAuditEvent) {
  const { data, error } = await supabase.rpc("append_lia_governance_audit", {
    p_user_id: userId,
    p_event_type: event.eventType,
    p_actor: event.actor,
    p_correlation_id: event.correlationId ?? null,
    p_source_refs: sanitize(event.sourceRefs ?? {}),
    p_metadata: sanitize(event.metadata ?? {}),
  });
  if (error) throw new Error(`governance_audit:${error.message}`);
  return data;
}
