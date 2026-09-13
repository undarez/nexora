import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildLiaFinancialProjection } from "@/lib/lia/financial-data-gateway";
import { assertSameOrigin } from "@/lib/security/csrf";

export async function GET(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête refusée." }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase n'est pas configuré." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  try {
    const url = new URL(request.url);
    const days = Number(url.searchParams.get("days") ?? 90);
    const projection = await buildLiaFinancialProjection({ supabase, userId: user.id, days });
    return NextResponse.json(projection, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Projection financière indisponible." }, { status: 500 });
  }
}
