import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: "Supabase indisponible." }, { status: 503 });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const params = new URL(request.url).searchParams;
    const days = Math.min(Math.max(Number(params.get("days") ?? 90), 7), 365);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data, error } = await supabase
      .from("bank_balance_snapshots")
      .select("account_id,balance,currency,captured_at")
      .eq("user_id", user.id)
      .gte("captured_at", since)
      .order("captured_at", { ascending: true });
    if (error) throw error;

    // Keep currencies isolated: summing EUR + USD would produce a meaningless total.
    const daily = new Map<string, Record<string, number>>();
    for (const row of data ?? []) {
      const date = String(row.captured_at).slice(0, 10);
      const currency = String(row.currency || "EUR").toUpperCase();
      const entry = daily.get(date) ?? {};
      entry[currency] = (entry[currency] ?? 0) + Number(row.balance ?? 0);
      daily.set(date, entry);
    }

    const points = [...daily.entries()].map(([date, values]) => ({
      date,
      currencies: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v.toFixed(2))])),
      eur: Number((values.EUR ?? 0).toFixed(2)),
    }));

    return NextResponse.json({ days, points, rawDataExposed: false }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Historique bancaire indisponible." }, { status: 500 });
  }
}
