import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { advanceLiaOrchestration } from "@/lib/lia/orchestrator-runtime";

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête refusée." }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.run_id !== "string" || !body.run_id) return NextResponse.json({ error: "run_id invalide." }, { status: 400 });
  try {
    const result = await advanceLiaOrchestration({
      supabase, userId: user.id, runId: body.run_id,
      action: { actionKey: body.action_key, title: body.title, description: body.description, payload: body.payload },
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Impossible d'avancer l'orchestration." }, { status: 500 });
  }
}
