import type { NexoraBrainMessage, NexoraBrainResult } from "./types";

function nativeConfig() {
  return {
    url: (process.env.NEXORA_BRAIN_API_URL || "").replace(/\/$/, ""),
    key: process.env.NEXORA_BRAIN_API_KEY || "",
    model: process.env.NEXORA_BRAIN_MODEL || "nexora-lia",
  };
}

export function nexoraBrainConfigured() {
  const config = nativeConfig();
  return Boolean(config.url);
}

/**
 * NEXORA-owned brain boundary.
 *
 * The endpoint is intentionally OpenAI-compatible so the application is not
 * coupled to Ollama, a hosted AI vendor, or a specific inference engine.
 * A self-hosted llama.cpp server is one supported implementation of this
 * contract. The actual model weights remain outside the Next.js bundle.
 */
export async function nexoraBrainChat(messages: NexoraBrainMessage[], signal?: AbortSignal): Promise<NexoraBrainResult> {
  const config = nativeConfig();
  if (!config.url) throw new Error("Le moteur NEXORA Brain n'est pas configuré.");

  const startedAt = Date.now();
  const response = await fetch(`${config.url}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.key ? { Authorization: `Bearer ${config.key}` } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.2,
      stream: false,
    }),
    cache: "no-store",
    signal,
  });

  const raw = await response.text();
  let payload: any = {};
  try { payload = JSON.parse(raw); } catch {}
  if (!response.ok) {
    throw new Error(payload?.error?.message || `NEXORA Brain a refusé la requête (${response.status}).`);
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("NEXORA Brain n'a pas renvoyé de réponse exploitable.");
  }

  return {
    content,
    model: payload?.model || config.model,
    provider: "native",
    usage: {
      inputChars: messages.reduce((n, message) => n + message.content.length, 0),
      outputChars: content.length,
      generatedTokens: Number.isFinite(payload?.usage?.completion_tokens) ? payload.usage.completion_tokens : null,
      latencyMs: Date.now() - startedAt,
    },
  };
}

export async function nexoraBrainHealth() {
  const config = nativeConfig();
  if (!config.url) return false;
  try {
    const response = await fetch(`${config.url}/health`, { method: "GET", cache: "no-store", signal: AbortSignal.timeout(3000) });
    return response.ok;
  } catch {
    return false;
  }
}
