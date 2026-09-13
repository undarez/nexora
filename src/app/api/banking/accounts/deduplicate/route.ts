import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Requête cross-origin refusée." }, { status: 403 });
  }

  try {
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: "Supabase indisponible." }, { status: 503 });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as { keepAccountId?: string };
    const keepAccountId = String(body.keepAccountId ?? "");
    if (!keepAccountId) return NextResponse.json({ error: "Compte à conserver manquant." }, { status: 400 });

    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase serveur indisponible." }, { status: 503 });

    const { data: keep, error: keepError } = await admin
      .from("bank_accounts")
      .select("id,user_id,provider,iban_masked,currency,status")
      .eq("id", keepAccountId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (keepError) throw keepError;
    if (!keep) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });

    if (!keep.iban_masked) {
      return NextResponse.json({ error: "Ce compte ne possède pas d'identifiant bancaire stable. NEXORA ne le fusionne pas automatiquement pour éviter de confondre deux comptes." }, { status: 400 });
    }

    const { data: duplicates, error: duplicateError } = await admin
      .from("bank_accounts")
      .select("id")
      .eq("user_id", user.id)
      .eq("provider", keep.provider)
      .eq("iban_masked", keep.iban_masked)
      .eq("currency", keep.currency)
      .neq("id", keep.id)
      .neq("status", "revoked");
    if (duplicateError) throw duplicateError;

    const duplicateIds = (duplicates ?? []).map((row) => String(row.id));
    if (duplicateIds.length) {
      const { error: disableError } = await admin
        .from("bank_accounts")
        .update({ status: "disabled", updated_at: new Date().toISOString() })
        .in("id", duplicateIds)
        .eq("user_id", user.id);
      if (disableError) throw disableError;
    }

    const { error: activateError } = await admin
      .from("bank_accounts")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", keep.id)
      .eq("user_id", user.id);
    if (activateError) throw activateError;

    return NextResponse.json({ ok: true, keptAccountId: keep.id, disabledAccountIds: duplicateIds, disabledCount: duplicateIds.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Correction des doublons impossible." }, { status: 500 });
  }
}
