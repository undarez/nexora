import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Service indisponible." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  return NextResponse.json({ provider: "outlook", api: "Microsoft Graph", status: "available_when_oauth_configured", scope: "Mail.Read" }, { headers: { "Cache-Control": "no-store" } });
}
