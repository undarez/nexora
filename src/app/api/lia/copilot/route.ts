import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildLiaFinancialCopilot } from "@/lib/lia/financial-copilot";

export async function GET(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase n'est pas configuré." }, { status: 503 });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  try {
    const url = new URL(request.url);
    const objective = url.searchParams.get("objective") || undefined;
    const snapshot = await buildLiaFinancialCopilot({ supabase, userId: user.id, objective });
    return NextResponse.json({ copilot: snapshot });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Copilote indisponible." }, { status: 500 });
  }
}
