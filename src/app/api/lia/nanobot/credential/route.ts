import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { issueNanobotRuntimeCredential, revokeNanobotRuntimeCredential } from "@/lib/security/nanobot-runtime-credential";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: "Supabase n'est pas configuré." }, { status: 503 });
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

    let label = "NEXORA Nanobot runtime";
    try {
      const body = await request.json();
      if (typeof body?.label === "string" && body.label.trim()) label = body.label.trim().slice(0, 120);
    } catch {}

    const result = await issueNanobotRuntimeCredential(user.id, label);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "nanobot_credential_issue_failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: "Supabase n'est pas configuré." }, { status: 503 });
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

    const url = new URL(request.url);
    const credentialId = url.searchParams.get("id")?.trim();
    if (!credentialId) return NextResponse.json({ error: "credential_id_required" }, { status: 400 });
    await revokeNanobotRuntimeCredential(user.id, credentialId);
    return NextResponse.json({ revoked: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "nanobot_credential_revoke_failed" }, { status: 500 });
  }
}
