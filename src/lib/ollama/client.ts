export type OllamaMessage = { role: "system" | "user" | "assistant"; content: string };

type OllamaResponse = {
  model?: string;
  message?: { content?: string };
  error?: string;
  total_duration?: number;
  eval_count?: number;
  eval_duration?: number;
};

function getConfig() {
  const url = (process.env.OLLAMA_API_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
  const model = process.env.OLLAMA_MODEL || "gpt-oss-20b-64k:latest";
  const context = Math.max(4096, Number(process.env.OLLAMA_CONTEXT_LENGTH || 65536));
  const enabled = process.env.OLLAMA_ENABLED === "true" || (process.env.OLLAMA_ENABLED == null && process.env.NODE_ENV !== "production");
  return { url, model, context, enabled };
}

export function ollamaEnabled() {
  return getConfig().enabled;
}

export function ollamaConfig() {
  const { url, model, context, enabled } = getConfig();
  return { url, model, enabled, context };
}

export async function ollamaChat(messages: OllamaMessage[], signal?: AbortSignal) {
  const requestSignal = signal ?? AbortSignal.timeout(Number(process.env.OLLAMA_TIMEOUT_MS || 120_000));
  const { url, model, context, enabled } = getConfig();
  if (!enabled) throw new Error("Le moteur Ollama local est désactivé.");

  const response = await fetch(`${url}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: { num_ctx: context },
    }),
    cache: "no-store",
    signal: requestSignal,
  });

  const raw = await response.text();
  let payload: OllamaResponse = {};
  try { payload = JSON.parse(raw); } catch {}

  if (!response.ok) throw new Error(payload.error || `Ollama a refusé la requête (${response.status}).`);
  const content = payload.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Ollama n'a pas renvoyé de réponse exploitable.");

  const evalSeconds = payload.eval_duration && payload.eval_duration > 0 ? payload.eval_duration / 1e9 : 0;
  return {
    content,
    model: payload.model || model,
    generatedTokens: payload.eval_count ?? null,
    tokensPerSecond: evalSeconds > 0 && payload.eval_count ? payload.eval_count / evalSeconds : null,
    totalDurationMs: payload.total_duration && payload.total_duration > 0 ? payload.total_duration / 1e6 : null,
  };
}

export async function ollamaHealth() {
  const { url, enabled } = getConfig();
  if (!enabled) return false;
  try {
    const response = await fetch(`${url}/api/tags`, { cache: "no-store", signal: AbortSignal.timeout(3000) });
    return response.ok;
  } catch { return false; }
}
