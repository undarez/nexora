import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { runLiaContinuousCycle, type LiaContinuousOperation } from "@/lib/lia/continuous-operations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server secret missing.");
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}

function authorized(request: Request) {
  const configured = process.env.LIA_CRON_SECRET || process.env.CRON_SECRET;
  return Boolean(configured && request.headers.get("authorization") === `Bearer ${configured}`);
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Continuous runtime non autorisé." }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    const userId = typeof body?.user_id === "string" ? body.user_id : "";
    const forced = typeof body?.operation === "string" ? body.operation as LiaContinuousOperation : undefined;
    if (!userId) return NextResponse.json({ error: "user_id_required" }, { status: 400 });
    if (forced && !["recover","goal","learn","observe","idle"].includes(forced)) return NextResponse.json({ error: "invalid_operation" }, { status: 400 });
    const result = await runLiaContinuousCycle({ supabase: admin(), userId, forcedOperation: forced });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Continuous runtime unavailable." }, { status: 503 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
