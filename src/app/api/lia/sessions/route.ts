import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { listCognitiveSessions } from "@/lib/lia/cognitive-session";

export async function GET(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête refusée." }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase n'est pas configuré." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  try {
    return NextResponse.json({ sessions: await listCognitiveSessions(supabase, user.id) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Impossible de charger les sessions.";
    const missing = /schema cache|could not find the table|relation .* does not exist|PGRST205|42P01/i.test(message);
    if (missing) return NextResponse.json({ sessions: [], degraded: true, reason: "cognitive_session_storage_unavailable" });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
