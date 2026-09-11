import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { runFinancialAutopilotObservation, autoClassifyHighConfidence } from "@/lib/lia/financial-autopilot";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  try { return NextResponse.json(await runFinancialAutopilotObservation(supabase, user.id)); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Autopilot indisponible." }, { status: 503 }); }
}

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch { return NextResponse.json({ error: "Origine refusée." }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({})) as { mode?: string };
    if (body.mode === "classify") return NextResponse.json(await autoClassifyHighConfidence(supabase, user.id));
    return NextResponse.json(await runFinancialAutopilotObservation(supabase, user.id));
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Autopilot indisponible." }, { status: 503 }); }
}
