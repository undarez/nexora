import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { resumeLiaOrchestration } from "@/lib/lia/verification-engine";

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête refusée." }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.run_id !== "string" || !body.run_id) return NextResponse.json({ error: "run_id invalide." }, { status: 400 });
  try { return NextResponse.json(await resumeLiaOrchestration({ supabase, userId: user.id, runId: body.run_id })); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Impossible de reprendre l'orchestration." }, { status: 500 }); }
}
