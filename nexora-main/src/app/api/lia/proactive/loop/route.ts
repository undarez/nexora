import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { runProactiveFinancialLoop } from "@/lib/lia/proactive/loop";

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch { return NextResponse.json({ error: "Origine refusée." }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const signalId = typeof body?.signal_id === "string" ? body.signal_id.slice(0, 160) : undefined;
  try { return NextResponse.json(await runProactiveFinancialLoop(supabase, user.id, signalId)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Boucle proactive indisponible." }, { status: 502 }); }
}
