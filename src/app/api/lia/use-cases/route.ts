import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchLiaUseCases } from "@/lib/lia/use-cases/registry";
import { isAdminEmail } from "@/lib/auth/admin";

export async function GET(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: "Accès administrateur requis." }, { status: 403 });
  const url = new URL(request.url);
  try {
    const useCases = await searchLiaUseCases(
      supabase,
      user.id,
      url.searchParams.get("q") ?? "",
      url.searchParams.get("category") ?? undefined,
      Number(url.searchParams.get("limit") ?? 20),
    );
    return NextResponse.json({ useCases });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de charger les Use Cases." }, { status: 502 });
  }
}
