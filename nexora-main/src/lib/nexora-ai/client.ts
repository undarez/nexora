import { ensureLocalNativeEngine, localNativeConfig } from "./runtime";

export type LocalNativeMessage = { role: "system" | "user" | "assistant"; content: string };

export async function localNativeChat(messages: LocalNativeMessage[], signal?: AbortSignal) {
  const ready = await ensureLocalNativeEngine();
  if (!ready) throw new Error("Le moteur IA local NEXORA n'est pas installé ou son modèle est introuvable.");
  const c = localNativeConfig();
  const response = await fetch(`${c.endpoint}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "nexora-gpt-oss-20b", messages, temperature: 0.2, stream: false }),
    cache: "no-store",
    signal: signal ?? AbortSignal.timeout(Number(process.env.NEXORA_AI_TIMEOUT_MS || 180000)),
  });
  const raw = await response.text();
  let payload: any = {};
  try { payload = JSON.parse(raw); } catch {}
  if (!response.ok) throw new Error(payload?.error?.message || `Le moteur local NEXORA a refusé la requête (${response.status}).`);
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Le moteur local NEXORA n'a pas renvoyé de réponse exploitable.");
  return { content, model: payload?.model || "nexora-gpt-oss-20b" };
}
