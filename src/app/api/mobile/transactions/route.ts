import { getMobileAuth, mobileAuthResponse } from "@/lib/auth/mobile";

export async function GET(request: Request) {
  try {
    const auth = await getMobileAuth(request);
    if (!auth) return mobileAuthResponse();
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 100);
    const [bankResult, manualResult] = await Promise.all([
      auth.supabase
        .from("bank_transactions")
        .select("id,amount,currency,category,description,merchant_name,booked_at")
        .eq("user_id", auth.user.id)
        .order("booked_at", { ascending: false })
        .limit(limit),
      auth.supabase
        .from("transactions")
        .select("id,amount,label,occurred_at,categories(name)")
        .eq("user_id", auth.user.id)
        .order("occurred_at", { ascending: false })
        .limit(limit),
    ]);
    if (bankResult.error && !/relation .*bank_transactions.*does not exist/i.test(bankResult.error.message)) throw bankResult.error;
    if (manualResult.error) throw manualResult.error;

    const bank = (bankResult.data ?? []).map((row: any) => ({
      id: `bank:${String(row.id)}`, amount: Number(row.amount ?? 0), currency: row.currency ?? "EUR",
      category: row.category ?? null, description: row.description ?? null,
      merchant_name: row.merchant_name ?? null, booked_at: row.booked_at ?? null,
    }));
    const manual = (manualResult.data ?? []).map((row: any) => ({
      id: `manual:${String(row.id)}`, amount: Number(row.amount ?? 0), currency: "EUR",
      category: row.categories?.name ?? null, description: row.label ?? null,
      merchant_name: null, booked_at: row.occurred_at ?? null,
    }));
    const transactions = [...bank, ...manual].sort((a, b) => String(b.booked_at).localeCompare(String(a.booked_at))).slice(0, limit);
    return Response.json({ transactions }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Transactions indisponibles." }, { status: 500 });
  }
}
