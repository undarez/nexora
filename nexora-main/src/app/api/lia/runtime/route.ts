import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { getLiaRuntimeStatus } from "@/lib/lia/runtime-registry";
import { isAdminEmail } from "@/lib/auth/admin";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: "Accès administrateur requis." }, { status: 403 });
  try { return NextResponse.json(await getLiaRuntimeStatus(supabase, user.id), { headers: { "Cache-Control": "no-store" } }); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Statut runtime indisponible." }, { status: 503 }); }
}

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête refusée." }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: "Accès administrateur requis." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";
  try {
    if (action === "stop") {
      const loopRunId = typeof body?.loopRunId === "string" ? body.loopRunId : "";
      if (!loopRunId) return NextResponse.json({ error: "loopRunId requis." }, { status: 400 });
      // Stop is intentionally a server-mediated control action. The function only reduces execution state.
      const { data, error } = await supabase.rpc("lia_stop_loop", { p_user_id: user.id, p_loop_run_id: loopRunId });
      if (error) return NextResponse.json({ error: error.message }, { status: 503 });
      return NextResponse.json({ stopped: Boolean(data), action: "stop" });
    }
    if (action === "schedule") {
      return NextResponse.json({ error: "La planification est gérée automatiquement par LIA." }, { status: 410 });
    }
    return NextResponse.json({ error: "Action runtime non autorisée." }, { status: 400 });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Action runtime impossible." }, { status: 503 }); }
}
