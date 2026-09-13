import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { diagnosticId, errorInfo, logDiagnostic } from "@/lib/observability/server";

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête cross-origin refusée." }, { status: 403 }); }
  const requestId = diagnosticId();
  const startedAt = Date.now();
  logDiagnostic("info", "notifications.refresh.start", { requestId });
  const supabase = await createClient();
  if (!supabase) {
    logDiagnostic("warn", "notifications.refresh.unavailable", { requestId, reason: "supabase_not_configured" });
    return NextResponse.json({ ok: false, error: "supabase_not_configured", requestId }, { status: 503 });
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    logDiagnostic("warn", "notifications.refresh.unauthorized", { requestId, durationMs: Date.now() - startedAt });
    return NextResponse.json({ ok: false, error: "unauthorized", requestId }, { status: 401 });
  }
  const { error } = await supabase.rpc("refresh_financial_notifications", { p_user_id: user.id });
  if (error) {
    const missing = /schema cache|could not find the table|could not find the function|function .* does not exist|relation .* does not exist|PGRST202|PGRST205|42P01|42883/i.test(error.message);
    if (missing) {
      logDiagnostic("warn", "notifications.refresh.degraded", { requestId, durationMs: Date.now() - startedAt, reason: "notification_storage_unavailable" });
      return NextResponse.json({ ok: true, degraded: true, refreshed: false, reason: "notification_storage_unavailable", requestId });
    }
    logDiagnostic("error", "notifications.refresh.failed", { requestId, durationMs: Date.now() - startedAt, ...errorInfo(error) });
    console.error("[notifications/refresh] RPC failed", error);
    return NextResponse.json({ ok: false, error: "notification_refresh_failed", requestId }, { status: 500 });
  }
  logDiagnostic("info", "notifications.refresh.success", { requestId, durationMs: Date.now() - startedAt });
  return NextResponse.json({ ok: true, requestId });
}
