import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { synthesizeVoice, type VoiceProvider } from "@/lib/lia/voice/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROVIDERS = new Set<VoiceProvider>(["hume", "elevenlabs"]);

export async function POST(request: Request) {
  try { assertSameOrigin(request); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête refusée." }, { status: 403 }); }

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.text !== "string" || !body.text.trim()) {
    return NextResponse.json({ error: "text_required" }, { status: 400 });
  }

  const provider = typeof body.provider === "string" && PROVIDERS.has(body.provider as VoiceProvider)
    ? body.provider as VoiceProvider
    : undefined;

  try {
    const audio = await synthesizeVoice({
      text: body.text,
      provider,
      voiceId: typeof body.voiceId === "string" ? body.voiceId.slice(0, 200) : undefined,
      voiceName: typeof body.voiceName === "string" ? body.voiceName.slice(0, 120) : undefined,
      style: typeof body.style === "string" ? body.style.slice(0, 1000) : "Voix chaleureuse, claire et naturelle.",
    });
    return new Response(new Uint8Array(audio), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "X-Nexora-Voice-User": user.id.slice(0, 8),
      },
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Synthèse vocale indisponible.",
    }, { status: 503 });
  }
}
