import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { liaProviderHealth } from "@/lib/lia/provider";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await liaProviderHealth()) }, { headers: { "Cache-Control": "no-store" } });
}
