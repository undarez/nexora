import { getMobileAuth, mobileAuthResponse } from "@/lib/auth/mobile";
import { assertSameOrigin } from "@/lib/security/csrf";
import { liaChat, type LiaProviderMessage } from "@/lib/lia/provider";
import { buildUnifiedFinancialContext } from "@/lib/finance/unified-financial-context";
import { detectLiaConversationIntent, deterministicConversationReply, LIA_CONVERSATION_SYSTEM_PROMPT } from "@/lib/lia/conversation";

const MAX_HISTORY = 8;
const MAX_QUESTION = 4000;

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Requête refusée." }, { status: 403 }); }
  try {
    const auth = await getMobileAuth(request);
    if (!auth) return mobileAuthResponse();
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 32768) return Response.json({ error: "Requête trop volumineuse." }, { status: 413, headers: { "Cache-Control": "no-store" } });
    const body = await request.json().catch(() => ({})) as { question?: unknown; history?: unknown };
    const question = typeof body.question === "string" ? body.question.trim().slice(0, MAX_QUESTION) : "";
    if (!question) return Response.json({ error: "Question requise." }, { status: 400 });
    const history: LiaProviderMessage[] = Array.isArray(body.history)
      ? body.history.filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string")
          .map((m: any): LiaProviderMessage => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content).slice(0, 3000) })).slice(-MAX_HISTORY)
      : [];
    const intent = detectLiaConversationIntent(question);
    if (intent !== "financial") {
      if (["greeting", "wellbeing", "thanks", "farewell", "identity"].includes(intent)) {
        const analysis = deterministicConversationReply(intent as Exclude<typeof intent, "financial" | "small_talk">);
        return Response.json({ analysis, model: "lia-conversation", provider: "deterministic", task: "conversation" });
      }
      const result = await liaChat([{ role: "system", content: LIA_CONVERSATION_SYSTEM_PROMPT }, ...history, { role: "user", content: question }]);
      return Response.json({ analysis: result.content, model: result.model, provider: result.provider, task: "conversation" });
    }
    const context = await buildUnifiedFinancialContext({ supabase: auth.supabase, userId: auth.user.id });
    const prompt = `Tu es LIA de NEXORA. Réponds en français simple, concret et prudent. Utilise uniquement les informations financières fournies ci-dessous pour les faits personnels. Ne prétends pas avoir exécuté une action. Si une donnée manque, dis-le.\n\nCONTEXTE FINANCIER:\n${JSON.stringify(context).slice(0, 30000)}`;
    const result = await liaChat([{ role: "system", content: prompt }, ...history, { role: "user", content: question }]);
    return Response.json({ analysis: result.content, model: result.model, provider: result.provider, task: "financial_analysis" }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "LIA est indisponible." }, { status: 500 });
  }
}
