import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildLiaFinancialCopilot } from "@/lib/lia/financial-copilot";
import { assertSameOrigin } from "@/lib/security/csrf";
import { runNexoraAutonomousAgent } from "@/lib/lia/autonomous-agent-v3";
import { buildCopilotObjective, getNexoraPageContext } from "@/lib/lia/copilot-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function auth() {
  const supabase = await createClient();
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Authentification requise.");
  return { supabase, user };
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await auth();
    const objective = new URL(request.url).searchParams.get("objective") || undefined;
    return NextResponse.json({ copilot: await buildLiaFinancialCopilot({ supabase, userId: user.id, objective }) });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Copilote indisponible." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête refusée." }, { status: 403 }); }
  try {
    const { supabase, user } = await auth();
    let body: Record<string, unknown> = {};
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 }); }
    const path = typeof body.path === "string" ? body.path.slice(0, 300) : "/dashboard";
    const message = typeof body.message === "string" && body.message.trim() ? body.message.trim().slice(0, 1800) : undefined;
    const ctx = getNexoraPageContext(path);
    const result = await runNexoraAutonomousAgent(supabase, user.id, buildCopilotObjective(ctx, message), { maxIterations: message ? 6 : 4 });
    return NextResponse.json({ ...result, page: ctx.page, section: ctx.section, proactive: !message });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Copilote indisponible." }, { status: 500 }); }
}
