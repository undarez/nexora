import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_EVENTS = new Set(["session_start", "page_view", "page_focus", "page_leave", "copilot_open", "copilot_message"]);

export async function POST(request: Request) {
  try { assertSameOrigin(request); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Requête refusée." }, { status: 403 }); }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase n'est pas configuré." }, { status: 503 });
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 }); }
  const eventType = typeof body.eventType === "string" ? body.eventType : "";
  if (!ALLOWED_EVENTS.has(eventType)) return NextResponse.json({ error: "Événement non autorisé." }, { status: 400 });

  const path = typeof body.path === "string" && body.path.startsWith("/") ? body.path.slice(0, 300) : "/";
  const page = typeof body.page === "string" ? body.page.slice(0, 100) : null;
  const sessionId = typeof body.sessionId === "string" && /^[a-zA-Z0-9_-]{16,80}$/.test(body.sessionId) ? body.sessionId : null;
  if (!sessionId) return NextResponse.json({ error: "Session invalide." }, { status: 400 });

  const metadata = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata : {};
  // Never accept raw page contents, transaction payloads, DOM text or arbitrary client data.
  const safeMetadata = Object.fromEntries(Object.entries(metadata as Record<string, unknown>).filter(([key, value]) => ["visible_seconds","navigation_source"].includes(key) && (typeof value === "string" || typeof value === "number" || typeof value === "boolean")));

  const { error } = await supabase.from("lia_user_activity").insert({
    user_id: user.id,
    session_id: sessionId,
    event_type: eventType,
    path,
    page,
    metadata: safeMetadata,
  });
  if (error) return NextResponse.json({ error: "Activité non enregistrée." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
