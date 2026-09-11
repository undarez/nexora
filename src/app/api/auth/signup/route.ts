import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { checkPassword, passwordPolicyMessage } from "@/lib/auth/password-policy";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const rawBody = await request.text();
    if (rawBody.length > 32_000) return NextResponse.json({ error: "Requête trop volumineuse." }, { status: 413 });
    const body = JSON.parse(rawBody);
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const confirmation = typeof body.confirmation === "string" ? body.confirmation : "";

    if (!email) return NextResponse.json({ error: "Indique ton adresse email." }, { status: 400 });
    if (!checkPassword(password).valid) return NextResponse.json({ error: passwordPolicyMessage(password) }, { status: 400 });
    if (password !== confirmation) return NextResponse.json({ error: "Les deux mots de passe ne sont pas identiques." }, { status: 400 });

    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: "Supabase n'est pas configuré." }, { status: 503 });

    const origin = new URL(request.url).origin;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${origin}/auth/confirm` },
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, hasSession: Boolean(data.session) });
  } catch {
    return NextResponse.json({ error: "Impossible de créer le compte pour le moment." }, { status: 500 });
  }
}
