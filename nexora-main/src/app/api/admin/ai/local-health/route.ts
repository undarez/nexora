import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin";
import { ollamaConfig, ollamaHealth } from "@/lib/ollama/client";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });

  try {
    await requireAdmin(supabase);
    const config = ollamaConfig();
    const healthy = await ollamaHealth();

    return NextResponse.json({
      ok: healthy,
      provider: "ollama",
      localFirst: process.env.ADMIN_AI_LOCAL_FIRST !== "false",
      hostedFallbackAllowed: process.env.ADMIN_AI_ALLOW_HOSTED_FALLBACK === "true",
      model: config.model,
      context: config.context,
    }, { status: healthy ? 200 : 503 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Accès administrateur requis.";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
