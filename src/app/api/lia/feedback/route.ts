import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { normalizeLiaFeedback, feedbackEvidenceWeight, type LiaFeedbackSignal } from "@/lib/lia/feedback-learning";
const signals = new Set<LiaFeedbackSignal>(["helpful", "not_helpful", "accepted", "rejected", "corrected"]);
export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "forbidden" }, { status: 403 }); }
  const supabase = await createClient(); if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.signal !== "string" || !signals.has(body.signal as LiaFeedbackSignal)) return NextResponse.json({ error: "invalid_feedback" }, { status: 400 });
  const feedback = normalizeLiaFeedback({ signal: body.signal as LiaFeedbackSignal, note: typeof body.note === "string" ? body.note : undefined, recommendationId: typeof body.recommendationId === "string" ? body.recommendationId : null, conversationId: typeof body.conversationId === "string" ? body.conversationId : null });
  const { data, error } = await supabase.from("lia_feedback_learning").insert({ user_id: user.id, signal: feedback.signal, note: feedback.note || null, recommendation_id: feedback.recommendationId, conversation_id: feedback.conversationId, learning_gate: feedback.learningGate, model_weight_update: false, policy_update: false, financial_fact_update: false, evidence_weight: feedbackEvidenceWeight(feedback.signal) }).select("id,signal,learning_gate,evidence_weight,created_at").single();
  if (error) return NextResponse.json({ error: "feedback_store_failed" }, { status: 500 });
  return NextResponse.json({ status: "candidate", feedback: data }, { status: 201 });
}
