import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { searchLiaSkills, buildSkillCandidate } from "@/lib/lia/skills/registry";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const skills = await searchLiaSkills(supabase, user.id, url.searchParams.get("q") ?? "", url.searchParams.get("category") ?? undefined, Number(url.searchParams.get("limit") ?? 8));
  return NextResponse.json({ skills });
}

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "forbidden" }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== "string" || typeof body.description !== "string" || typeof body.procedure !== "string") return NextResponse.json({ error: "invalid_skill_candidate" }, { status: 400 });
  const candidate = buildSkillCandidate({
    name: body.name, description: body.description, procedure: body.procedure,
    triggerContext: body.triggerContext && typeof body.triggerContext === "object" ? body.triggerContext : {},
    expectedResult: typeof body.expectedResult === "string" ? body.expectedResult : undefined,
    verificationSteps: Array.isArray(body.verificationSteps) ? body.verificationSteps.filter((x: unknown): x is string => typeof x === "string").slice(0, 10) : undefined,
    failureModes: Array.isArray(body.failureModes) ? body.failureModes.filter((x: unknown): x is string => typeof x === "string").slice(0, 10) : undefined,
    sourceRefs: Array.isArray(body.sourceRefs) ? body.sourceRefs.filter((x: unknown): x is string => typeof x === "string").slice(0, 10) : undefined,
    correction: typeof body.correction === "string" ? body.correction : undefined,
  });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return NextResponse.json({ error: "policy_engine_unavailable" }, { status: 503 });
  const admin = createAdminClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const slug = candidate.name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "skill-candidate";
  const { data, error } = await admin.rpc("lia_create_skill_candidate", {
    p_user_id:user.id,p_scope:"user",p_slug:slug,p_name:candidate.name,p_description:candidate.description,p_category:typeof body.category === "string" ? body.category.slice(0,60) : "general",p_source_type:typeof body.sourceType === "string" && ["user_provided","agent_generated","corrected"].includes(body.sourceType) ? body.sourceType : "agent_generated",p_content:candidate.content,p_trigger_context:candidate.triggerContext,p_expected_result:candidate.expectedResult,p_verification_steps:candidate.verificationSteps,p_failure_modes:candidate.failureModes,p_source_refs:candidate.sourceRefs,p_memory_gate:candidate.memoryGate
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json({ skill_id:data, status:"candidate", activation:"blocked_until_validation" }, { status: 201 });
}
