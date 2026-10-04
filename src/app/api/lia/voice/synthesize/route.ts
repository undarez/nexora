import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { synthesizeVoice, type VoiceProvider } from "@/lib/lia/voice/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const providers = new Set<VoiceProvider>(["fish", "hume", "elevenlabs"]);

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: "Supabase n'est pas configuré." }, { status: 503 });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const text = typeof body?.text === "string" ? body.text.trim().slice(0, 5000) : "";
    const requestedProvider = typeof body?.provider === "string" ? body.provider : undefined;
    if (!text) return NextResponse.json({ error: "Texte vocal requis." }, { status: 400 });
    if (requestedProvider && !providers.has(requestedProvider as VoiceProvider)) {
      return NextResponse.json({ error: "Provider vocal non autorisé." }, { status: 400 });
    }

    const audio = await synthesizeVoice({
      text,
      provider: requestedProvider as VoiceProvider | undefined,
      voiceId: typeof body?.voiceId === "string" ? body.voiceId.slice(0, 200) : undefined,
      voiceName: typeof body?.voiceName === "string" ? body.voiceName.slice(0, 200) : undefined,
      style: typeof body?.style === "string" ? body.style.slice(0, 500) : undefined,
    });

    return new NextResponse(new Uint8Array(audio), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "X-NEXORA-Voice-Provider": requestedProvider || process.env.NEXORA_VOICE_PROVIDER || "hume",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Synthèse vocale indisponible." },
      { status: 503 },
    );
  }
}
