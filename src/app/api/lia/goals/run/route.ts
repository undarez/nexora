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
  const maxSteps = Number(body.maxSteps ?? 8);
  if (!Number.isFinite(maxSteps) || maxSteps < 1 || maxSteps > 8) return NextResponse.json({ error: "maxSteps doit être compris entre 1 et 8." }, { status: 400 });
  try {
    const result = await runAutonomousGoal(supabase, user.id, loopRunId, maxSteps);
    return NextResponse.json({ ok: true, runner: result, governance: { autonomousWritesAllowed: false, criticalActionsRequireHuman: true, maxSteps: Math.min(8, Math.floor(maxSteps)), durableMemory: true, verification: true, learning: true, autonomousContinuation: true } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Runner LIA indisponible." }, { status: 409 });
  }
}
