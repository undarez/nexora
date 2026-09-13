import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { runLocalAutonomousAgent } from "@/lib/lia/autonomous-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Requête refusée." }, { status: 403 });
  }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase n'est pas configuré." }, { status: 503 });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  let objective = "Analyse ma situation financière et indique-moi les trois prochaines actions concrètes.";
  let maxIterations = 5;
  try {
    const body = await request.json();
    if (typeof body?.objective === "string" && body.objective.trim()) objective = body.objective.trim().slice(0, 4000);
    if (Number.isFinite(Number(body?.maxIterations))) maxIterations = Math.min(8, Math.max(1, Number(body.maxIterations)));
  } catch {
    // Defaults are intentional.
  }

  try {
    const result = await runLocalAutonomousAgent(supabase, user.id, objective, { maxIterations });
    return NextResponse.json(result, { status: result.status === "failed" ? 502 : 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Agent autonome indisponible." }, { status: 500 });
  }
}
