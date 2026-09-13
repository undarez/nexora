import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { assertSameOrigin } from "@/lib/security/csrf";
import { curateMemories, persistCuration, type MemoryCandidate } from "@/lib/lia/memory-curator";

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "forbidden" }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  let items: MemoryCandidate[] = [];
  if (body && Array.isArray(body.items)) items = body.items.filter((x: unknown): x is MemoryCandidate => !!x && typeof x === "object" && typeof (x as MemoryCandidate).id === "string" && typeof (x as MemoryCandidate).topic === "string" && ["observation","correction","proposal","decision"].includes((x as MemoryCandidate).memory_type)).slice(0, 100);
  if (!items.length) {
    const { data, error } = await supabase.from("ai_learning_memory").select("id,topic,memory_type,status,evidence,confidence,before_value,after_value").order("created_at", { ascending: false }).limit(100);
    if (error) return NextResponse.json({ error: "memory_read_failed", detail: error.message }, { status: 500 });
    items = (data ?? []) as MemoryCandidate[];
  }
  const report = curateMemories(items);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && secret) {
    const admin = createAdminClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
    try { await persistCuration(admin, user.id, report); } catch (e) { return NextResponse.json({ error: "curation_persistence_failed", detail: e instanceof Error ? e.message : "unknown", report }, { status: 500 }); }
  }
  return NextResponse.json({ status: "curation_review", ...report }, { status: 200 });
}
