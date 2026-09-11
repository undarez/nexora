import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { runAutonomousLearningCycle } from "@/lib/lia/learning/autonomous";

export const runtime = "nodejs";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server secret missing.");
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function cronAuthorized(request: Request) {
  const configured = process.env.LIA_CRON_SECRET;
  return Boolean(configured && request.headers.get("authorization") === `Bearer ${configured}`);
}

export async function POST(request: Request) {
  const isCron = cronAuthorized(request);
  if (!isCron) {
    try { assertSameOrigin(request); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "forbidden" }, { status: 403 }); }
  }
  try {
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const result = await runAutonomousLearningCycle(adminClient(), user.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "learning_unavailable" }, { status: 503 });
  }
}
