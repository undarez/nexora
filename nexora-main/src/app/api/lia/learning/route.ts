import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { learnFromObservation } from "@/lib/lia/adaptive-learning";

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "forbidden" }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.proposalId !== "string" || !["verified","mismatch","inconclusive","failed"].includes(body.outcome)) return NextResponse.json({ error: "invalid_learning_observation" }, { status: 400 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return NextResponse.json({ error: "runtime_server_incomplete" }, { status: 503 });
  const admin = createAdminClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: proposal } = await supabase.from("lia_action_proposals").select("id,user_id,action_key").eq("id", body.proposalId).eq("user_id", user.id).maybeSingle();
  if (!proposal) return NextResponse.json({ error: "proposal_not_found" }, { status: 404 });
  const expected = body.expected && typeof body.expected === "object" ? body.expected : {};
  const actual = body.actual && typeof body.actual === "object" ? body.actual : {};
  const checks = Array.isArray(body.checks) ? body.checks.filter((c: any) => c && typeof c.key === "string" && typeof c.expected === "boolean" && typeof c.observed === "boolean").slice(0, 30) : [];
  try {
    const result = await learnFromObservation(admin, { userId: user.id, loopRunId: typeof body.loopRunId === "string" ? body.loopRunId : null, proposalId: proposal.id, actionKey: proposal.action_key, outcome: body.outcome, expected, actual, checks });
    return NextResponse.json({ status: "candidate", ...result }, { status: 201 });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "learning_failed" }, { status: 500 }); }
}
