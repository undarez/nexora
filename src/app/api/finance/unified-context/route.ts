import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { buildUnifiedFinancialContext } from "@/lib/finance/unified-financial-context";

export async function GET(request: Request) {
  try { assertSameOrigin(request); } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Requête refusée." }, { status: 403 });
  }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  try {
    const url = new URL(request.url);
    const period = url.searchParams.get("month") || undefined;
    const context = await buildUnifiedFinancialContext({ supabase, userId: user.id, periodStart: period });
    return NextResponse.json(context, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Contexte financier indisponible." }, { status: 500 });
  }
}
