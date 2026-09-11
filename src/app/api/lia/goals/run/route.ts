import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { runAutonomousGoal } from "@/lib/lia/autonomous-goal-runner";

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête refusée." }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase n'est pas configuré." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  let body: any = {};
  try { body = await request.json(); } catch {}
  const loopRunId = typeof body.loopRunId === "string" ? body.loopRunId : "";
  if (!loopRunId) return NextResponse.json({ error: "loopRunId requis." }, { status: 400 });
  const maxSteps = Number(body.maxSteps ?? 3);
  if (!Number.isFinite(maxSteps) || maxSteps < 1 || maxSteps > 5) return NextResponse.json({ error: "maxSteps doit être compris entre 1 et 5." }, { status: 400 });
  try {
    const result = await runAutonomousGoal(supabase, user.id, loopRunId, maxSteps);
    return NextResponse.json({ ok: true, runner: result, governance: { autonomousWritesAllowed: false, criticalActionsRequireHuman: true, maxSteps: Math.min(5, Math.floor(maxSteps)) } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Runner LIA indisponible." }, { status: 409 });
  }
}
