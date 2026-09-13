import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertSameOrigin } from "@/lib/security/csrf";
import { classifyTransaction } from "@/lib/finance/transaction-categories";

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Requête cross-origin refusée." }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase indisponible." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase serveur indisponible." }, { status: 503 });
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  const { data, error } = await admin.from("bank_transactions").select("id,amount,booked_at,description,merchant_name,category").eq("user_id", user.id).gte("booked_at", start).lt("booked_at", end).limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let updated = 0;
  for (const tx of data ?? []) {
    const category = classifyTransaction({ label: tx.merchant_name, description: tx.description, providerCategory: tx.category, amount: Number(tx.amount) }).label;
    if (!tx.category || tx.category !== category) {
      const result = await admin.from("bank_transactions").update({ category, updated_at: new Date().toISOString() }).eq("id", tx.id).eq("user_id", user.id);
      if (!result.error) updated += 1;
    }
  }
  return NextResponse.json({ updated });
}
