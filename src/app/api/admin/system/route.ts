import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/auth/admin";
import { assertSameOrigin } from "@/lib/security/csrf";
import { getLiaRuntimeControls } from "@/lib/lia/runtime/controls";

function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server secret missing.");
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  const { user, isAdmin } = await getAdminContext(supabase);
  if (!user || !isAdmin) return NextResponse.json({ error: "Accès administrateur requis." }, { status: 403 });
  try {
    const db = adminDb();
    const controls = await getLiaRuntimeControls(db);
    const [{ count: jobs }, { count: running }, { count: errors }, { count: events }] = await Promise.all([
      db.from("lia_runtime_jobs").select("id", { count: "exact", head: true }).eq("runtime_type", "cron"),
      db.from("lia_runtime_jobs").select("id", { count: "exact", head: true }).eq("runtime_type", "cron").eq("status", "running"),
      db.from("lia_runtime_events").select("id", { count: "exact", head: true }).in("status", ["failed", "error"]).gte("created_at", new Date(Date.now() - 86400000).toISOString()),
      db.from("lia_runtime_events").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 86400000).toISOString()),
    ]);
    const { data: recentJobs } = await db.from("lia_runtime_jobs").select("id,user_id,name,action,status,next_run_at,last_run_at,last_status,last_error,failure_count,admin_disabled").eq("runtime_type", "cron").order("updated_at", { ascending: false }).limit(20);
    return NextResponse.json({ controls, metrics: { jobs: jobs ?? 0, running: running ?? 0, errors24h: errors ?? 0, events24h: events ?? 0 }, jobs: recentJobs ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Système indisponible." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête refusée." }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  const { user, isAdmin } = await getAdminContext(supabase);
  if (!user || !isAdmin) return NextResponse.json({ error: "Accès administrateur requis." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const allowed = ["ai_enabled", "web_research_enabled", "banking_refresh_enabled", "cron_autonomy_enabled"] as const;
  const key = body?.key as typeof allowed[number];
  if (!allowed.includes(key) || typeof body?.value !== "boolean") return NextResponse.json({ error: "Contrôle invalide." }, { status: 400 });
  try {
    const db = adminDb();
    const { error } = await db.from("lia_runtime_controls").update({ [key]: body.value, updated_at: new Date().toISOString(), updated_by: user.id }).eq("id", 1);
    if (error) throw new Error(error.message);
    await db.rpc("lia_record_runtime_event", { p_user_id: user.id, p_runtime_type: "admin", p_event: "runtime.control_changed", p_status: body.value ? "enabled" : "disabled", p_payload: { control: key, value: body.value } });
    return NextResponse.json({ ok: true, controls: await getLiaRuntimeControls(db) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de modifier le contrôle." }, { status: 503 });
  }
}
