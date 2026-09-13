import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { encryptVaultPayload, maskSensitiveLabel } from "@/lib/lia/secure-vault";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configuration serveur incomplète.");
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function authUser() {
  const supabase = await createClient();
  if (!supabase) throw new Error("Supabase indisponible.");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return user;
}

export async function GET() {
  try {
    const user = await authUser();
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    const { data, error } = await admin().from("financial_secure_vault_items")
      .select("id,data_class,sensitivity_level,masked_label,provider_ref,status,created_at,updated_at,last_accessed_at")
      .eq("user_id", user.id).order("updated_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ securityLevel: 3, rawPayloadExposed: false, items: data ?? [] });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Coffre indisponible." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête cross-origin refusée." }, { status: 403 }); }
  try {
    const user = await authUser();
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    const body = await request.json() as { dataClass?: string; label?: string; providerRef?: string; payload?: unknown };
    if (!body.label?.trim() || !body.payload || !body.dataClass) return NextResponse.json({ error: "label, dataClass et payload sont requis." }, { status: 400 });
    if (!["bank_account", "bank_connection", "payment_instrument", "identity_document", "other_sensitive"].includes(body.dataClass)) return NextResponse.json({ error: "Classe de données invalide." }, { status: 400 });
    const encrypted = encryptVaultPayload(body.payload);
    const { data, error } = await admin().from("financial_secure_vault_items").insert({
      user_id: user.id, data_class: body.dataClass, sensitivity_level: 3, label: body.label.trim(), masked_label: maskSensitiveLabel(body.label), provider_ref: body.providerRef ?? null,
      ciphertext: encrypted.ciphertext, iv: encrypted.iv, auth_tag: encrypted.auth_tag, key_version: encrypted.version,
    }).select("id,data_class,sensitivity_level,masked_label,provider_ref,status,created_at").single();
    if (error) throw error;
    return NextResponse.json({ securityLevel: 3, rawPayloadExposed: false, item: data }, { status: 201 });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Impossible de verrouiller la donnée." }, { status: 500 }); }
}
