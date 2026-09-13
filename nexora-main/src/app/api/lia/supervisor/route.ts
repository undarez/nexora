import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { createFinancialSupervisorRun } from "@/lib/lia/agentic-supervisor";

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch { return NextResponse.json({ error: "Origine refusée." }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({})) as { objective?: unknown; triggerType?: unknown; allowedStrategies?: unknown; maxSteps?: unknown };
    const objective = typeof body.objective === "string" ? body.objective.trim() : "";
    if (!objective) return NextResponse.json({ error: "Objectif requis." }, { status: 400 });
    const allowedStrategies = Array.isArray(body.allowedStrategies) ? body.allowedStrategies.filter((x): x is string => typeof x === "string") : undefined;
    const triggers = new Set(["user_request", "scheduled", "proactive", "goal", "autopilot"]);
    const triggerType = triggers.has(String(body.triggerType)) ? String(body.triggerType) as any : "user_request";
    const result = await createFinancialSupervisorRun({ supabase, userId: user.id, objective, triggerType, allowedStrategies, maxSteps: typeof body.maxSteps === "number" ? body.maxSteps : undefined });
    return NextResponse.json(result);
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Superviseur indisponible." }, { status: 503 }); }
}
