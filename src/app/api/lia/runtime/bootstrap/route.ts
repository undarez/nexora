import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { ensureLiaAutonomousCron } from "@/lib/lia/runtime/auto-cron";

/**
 * Low-frequency bootstrap only. Cron provisioning must not run on every
 * protected route render; the client calls this once per browser session.
 */
export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête cross-origin refusée." }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await ensureLiaAutonomousCron(supabase, user.id);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
