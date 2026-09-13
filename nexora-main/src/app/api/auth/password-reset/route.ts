import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const rawBody = await request.text();
    if (rawBody.length > 32_000) return NextResponse.json({ error: "Requête trop volumineuse." }, { status: 413 });
    const body = JSON.parse(rawBody);
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!email) return NextResponse.json({ error: "Indique ton adresse email." }, { status: 400 });
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: "Supabase n'est pas configuré." }, { status: 503 });
    const origin = new URL(request.url).origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/reset-password` });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Impossible d'envoyer le lien de réinitialisation." }, { status: 500 });
  }
}
