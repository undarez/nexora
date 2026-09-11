import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: "Supabase indisponible." }, { status: 503 });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    const { data, error } = await supabase.from("bank_sync_runs").select("id,connection_id,provider,status,accounts_upserted,transactions_upserted,skipped_count,reason,error_code,started_at,completed_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
    if (error) throw error;
    return NextResponse.json({ runs: data ?? [], rawCredentialsExposed: false }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Historique indisponible." }, { status: 500 });
  }
}
