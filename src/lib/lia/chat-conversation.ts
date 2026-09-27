import { NextResponse } from "next/server";
import { liaChat } from "@/lib/lia/provider";
import { deterministicConversationReply, detectLiaConversationIntent, LIA_CONVERSATION_SYSTEM_PROMPT, selectHumanLiaResponse } from "@/lib/lia/conversation";

export async function handleLiaConversation(
  requestedQuestion: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
) {
  const conversationIntent = detectLiaConversationIntent(requestedQuestion);
  if (conversationIntent === "financial") return null;

// LIA has a true conversational lane. Lightweight social interaction must not
  // trigger financial database reads, research, planning or recommendations.
  const conversationIntent = detectLiaConversationIntent(requestedQuestion);
  if (conversationIntent !== "financial") {
    const historyContext = history.length > 0
      ? history.map((m) => ({ role: m.role, content: m.content })).slice(-8)
      : [];
    if (["greeting", "wellbeing", "thanks", "farewell", "identity", "small_talk"].includes(conversationIntent)) {
      const reply = deterministicConversationReply(conversationIntent, requestedQuestion);
      return NextResponse.json({ analysis: reply, model: "lia-conversation", provider: "deterministic", task: "conversation", conversation: { intent: conversationIntent, financialContextUsed: false } });
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
      return NextResponse.json({
        analysis: safeResponse.content,
        model: safeResponse.rejectedGenerated ? "lia-conversation-safety-fallback" : result.model,
        provider: safeResponse.rejectedGenerated ? "deterministic" : result.provider,
        task: "conversation",
        conversation: { intent: conversationIntent, financialContextUsed: false, generatedResponseRejected: safeResponse.rejectedGenerated },
      });
    } catch (error) {
      return NextResponse.json({ analysis: "Je suis là 😊 Dis-moi ce que tu as en tête.", model: "lia-conversation-fallback", provider: "deterministic", task: "conversation", conversation: { intent: conversationIntent, financialContextUsed: false }, warning: error instanceof Error ? error.message : "Mode conversationnel limité." });
    }
  }
}
