import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function logicalKey(account: { provider: string | null; iban_masked: string | null; currency: string | null; external_account_id: string | null }) {
  const provider = String(account.provider ?? "").toLowerCase();
  const currency = String(account.currency ?? "EUR").toUpperCase();
  const iban = String(account.iban_masked ?? "").replace(/\s+/g, "").toUpperCase();
  if (iban) return `${provider}|iban|${iban}|${currency}`;
  return `${provider}|external|${String(account.external_account_id ?? "")}|${currency}`;
}

export async function GET() {
  try {
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: "Supabase indisponible." }, { status: 503 });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const { data, error } = await supabase
      .from("bank_accounts")
      .select("id,name,provider,external_account_id,iban_masked,currency,balance,available_balance,status,last_synced_at,created_at,updated_at")
      .eq("user_id", user.id)
      .neq("status", "revoked")
      .order("updated_at", { ascending: false });
    if (error) throw error;

    const groups = new Map<string, Record<string, unknown>[]>();
    for (const account of data ?? []) {
      const key = logicalKey(account);
      const list = groups.get(key) ?? [];
      list.push(account);
      groups.set(key, list);
    }

    const duplicates = [...groups.entries()]
      .filter(([, accounts]) => accounts.length > 1)
      .map(([key, accounts]) => ({ key, accounts }));

    return NextResponse.json({ duplicates, duplicateCount: duplicates.length }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Détection des doublons impossible." }, { status: 500 });
  }
}
