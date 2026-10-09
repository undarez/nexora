import { NextResponse } from "next/server";
import { liaChat } from "@/lib/lia/provider";
import { evaluateAndCorrectLiaResponse } from "@/lib/lia/self-evaluation";
import type { createClient } from "@/lib/supabase/server";
import { deterministicConversationReply, detectLiaConversationIntent, LIA_CONVERSATION_SYSTEM_PROMPT, selectHumanLiaResponse } from "@/lib/lia/conversation";

export async function handleLiaConversation(
  requestedQuestion: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  options?: { supabase?: Awaited<ReturnType<typeof createClient>>; userId?: string },
) {
  const conversationIntent = detectLiaConversationIntent(requestedQuestion);
  if (conversationIntent === "financial") return null;

  const historyContext = history.length > 0
    ? history.map((m) => ({ role: m.role, content: m.content })).slice(-8)
    : [];
  if (["greeting", "wellbeing", "thanks", "farewell", "identity", "small_talk"].includes(conversationIntent)) {
    const reply = deterministicConversationReply(conversationIntent, requestedQuestion);
    const evaluation = evaluateAndCorrectLiaResponse({ response: reply, question: requestedQuestion, financialContextAvailable: false, externalResearchAvailable: false });
    if (options?.supabase && options.userId) await options.supabase.from("lia_response_evaluations").insert({ user_id: options.userId, loop_run_id: null, score: evaluation.evaluation.score, verdict: evaluation.evaluation.verdict, corrected: evaluation.evaluation.corrected, findings: evaluation.evaluation.findings });
    return NextResponse.json({ analysis: evaluation.response, selfEvaluation: { score: evaluation.evaluation.score, verdict: evaluation.evaluation.verdict, corrected: evaluation.evaluation.corrected, findingCount: evaluation.evaluation.findings.length }, model: "lia-conversation", provider: "deterministic", task: "conversation", conversation: { intent: conversationIntent, financialContextUsed: false } });
  }
  try {
    const result = await liaChat([
      { role: "system", content: LIA_CONVERSATION_SYSTEM_PROMPT },
      ...historyContext,
      { role: "user", content: requestedQuestion },
    ]);
    const safeResponse = selectHumanLiaResponse(
      result.content,
      deterministicConversationReply("small_talk", requestedQuestion),
    );
    const evaluation = evaluateAndCorrectLiaResponse({ response: safeResponse.content, question: requestedQuestion, financialContextAvailable: false, externalResearchAvailable: false });
    if (options?.supabase && options.userId) await options.supabase.from("lia_response_evaluations").insert({ user_id: options.userId, loop_run_id: null, score: evaluation.evaluation.score, verdict: evaluation.evaluation.verdict, corrected: evaluation.evaluation.corrected, findings: evaluation.evaluation.findings });
    return NextResponse.json({
      analysis: evaluation.response,
      selfEvaluation: { score: evaluation.evaluation.score, verdict: evaluation.evaluation.verdict, corrected: evaluation.evaluation.corrected, findingCount: evaluation.evaluation.findings.length },
      model: safeResponse.rejectedGenerated ? "lia-conversation-safety-fallback" : result.model,
      provider: safeResponse.rejectedGenerated ? "deterministic" : result.provider,
      task: "conversation",
      conversation: { intent: conversationIntent, financialContextUsed: false, generatedResponseRejected: safeResponse.rejectedGenerated },
    });
  } catch (error) {
    const fallback = "Je suis là 😊 Dis-moi ce que tu as en tête.";
    const evaluation = evaluateAndCorrectLiaResponse({ response: fallback, question: requestedQuestion, financialContextAvailable: false, externalResearchAvailable: false });
    if (options?.supabase && options.userId) await options.supabase.from("lia_response_evaluations").insert({ user_id: options.userId, loop_run_id: null, score: evaluation.evaluation.score, verdict: evaluation.evaluation.verdict, corrected: evaluation.evaluation.corrected, findings: evaluation.evaluation.findings });
    return NextResponse.json({ analysis: evaluation.response, selfEvaluation: { score: evaluation.evaluation.score, verdict: evaluation.evaluation.verdict, corrected: evaluation.evaluation.corrected, findingCount: evaluation.evaluation.findings.length }, model: "lia-conversation-fallback", provider: "deterministic", task: "conversation", conversation: { intent: conversationIntent, financialContextUsed: false }, warning: error instanceof Error ? error.message : "Mode conversationnel limité." });
  }
}
