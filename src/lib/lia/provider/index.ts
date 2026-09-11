import { nexoraBrainChat, nexoraBrainConfigured, nexoraBrainHealth } from "@/lib/lia/brain";
import { ollamaChat, ollamaConfig, ollamaEnabled } from "@/lib/ollama/client";

export type LiaProviderMessage = { role: "system" | "user" | "assistant"; content: string };
export type LiaProviderName = "native" | "ollama" | "remote" | "deterministic";
export type LiaProviderMode = "native_first" | "native_only" | "local_first" | "local_only" | "remote_only" | "deterministic_only";
export type LiaProviderUsage = {
  inputChars?: number | null;
  outputChars?: number | null;
  generatedTokens?: number | null;
  tokensPerSecond?: number | null;
  latencyMs?: number | null;
};
export type LiaProviderResult = { content: string; model: string; provider: LiaProviderName; usage?: LiaProviderUsage };

function remoteConfig() {
  return {
    url: (process.env.LIA_REMOTE_API_URL || "").replace(/\/$/, ""),
    key: process.env.LIA_REMOTE_API_KEY || "",
    model: process.env.LIA_REMOTE_MODEL || "",
  };
}

export function liaProviderConfig() {
  const raw = (process.env.LIA_PROVIDER_MODE || "native_first").toLowerCase();
  const mode: LiaProviderMode = ["native_first", "native_only", "local_first", "local_only", "remote_only", "deterministic_only"].includes(raw)
    ? raw as LiaProviderMode
    : "native_first";
  const remote = remoteConfig();
  return {
    mode,
    native: { configured: nexoraBrainConfigured(), model: process.env.NEXORA_BRAIN_MODEL || "nexora-lia" },
    local: ollamaConfig(),
    remote: { configured: Boolean(remote.url && remote.key && remote.model), model: remote.model || null, urlConfigured: Boolean(remote.url) },
    remoteFallbackExplicitlyEnabled: process.env.LIA_ALLOW_REMOTE_FALLBACK === "true",
  };
}

async function remoteChat(messages: LiaProviderMessage[], signal?: AbortSignal): Promise<LiaProviderResult> {
  const { url, key, model } = remoteConfig();
  if (!url || !key || !model) throw new Error("Aucun fournisseur distant LIA n'est configuré.");
  const startedAt = Date.now();
  const response = await fetch(`${url}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature: 0.2 }),
    cache: "no-store",
    signal,
  });
  const raw = await response.text();
  let payload: any = {};
  try { payload = JSON.parse(raw); } catch {}
  if (!response.ok) throw new Error(payload?.error?.message || `Le fournisseur distant a refusé la requête (${response.status}).`);
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Le fournisseur distant n'a pas renvoyé de réponse exploitable.");
  return {
    content,
    model: payload?.model || model,
    provider: "remote",
    usage: {
      inputChars: messages.reduce((n, message) => n + message.content.length, 0),
      outputChars: content.length,
      generatedTokens: Number.isFinite(payload?.usage?.completion_tokens) ? payload.usage.completion_tokens : null,
      latencyMs: Date.now() - startedAt,
    },
  };
}

function deterministicFallback(question: string) {
  return [
    "Je peux continuer sans fournisseur IA externe, mais je ne vais pas inventer une analyse.",
    "",
    `Question reçue : ${question}`,
    "",
    "Les données financières restent protégées côté serveur. Le moteur déterministe peut préparer et vérifier les éléments, puis une réponse générative pourra être produite dès que le cerveau NEXORA est disponible.",
    "Prochaine vérification : disponibilité du moteur NEXORA Brain.",
  ].join("\n");
}

/**
 * Provider boundary: the application is not coupled to Ollama or a hosted AI vendor.
 * NEXORA Brain is tried first when configured. Remote inference remains opt-in.
 */
export async function liaChat(messages: LiaProviderMessage[], signal?: AbortSignal): Promise<LiaProviderResult> {
  const config = liaProviderConfig();
  const errors: string[] = [];

  if (config.mode === "native_first" || config.mode === "native_only") {
    if (config.native.configured) {
      try {
        return await nexoraBrainChat(messages, signal);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "NEXORA Brain indisponible.");
        if (config.mode === "native_only") return { content: deterministicFallback([...messages].reverse().find(m => m.role === "user")?.content || ""), model: "deterministic-fallback", provider: "deterministic" };
      }
    } else if (config.mode === "native_only") {
      return { content: deterministicFallback([...messages].reverse().find(m => m.role === "user")?.content || ""), model: "deterministic-fallback", provider: "deterministic" };
    }
  }

  if (config.mode !== "remote_only" && config.mode !== "deterministic_only" && ollamaEnabled()) {
    try {
      const local = await ollamaChat(messages, signal);
      return {
        content: local.content,
        model: local.model,
        provider: "ollama",
        usage: {
          inputChars: messages.reduce((n, message) => n + message.content.length, 0),
          outputChars: local.content.length,
          generatedTokens: local.generatedTokens,
          tokensPerSecond: local.tokensPerSecond,
          latencyMs: local.totalDurationMs,
        },
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Moteur local indisponible.");
      if (config.mode === "local_only") return { content: deterministicFallback([...messages].reverse().find(m => m.role === "user")?.content || ""), model: "deterministic-fallback", provider: "deterministic" };
    }
  }

  const remoteAllowed = config.mode === "remote_only" || ((config.mode === "local_first" || config.mode === "native_first") && config.remoteFallbackExplicitlyEnabled);
  if (remoteAllowed) {
    try {
      return await remoteChat(messages, signal);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Fournisseur distant indisponible.");
    }
  }

  const userMessage = [...messages].reverse().find(message => message.role === "user")?.content || "";
  const fallback = deterministicFallback(userMessage.slice(0, 1000));
  return { content: errors.length ? `${fallback}\n\nContrôle provider : ${errors[0].slice(0, 300)}` : fallback, model: "deterministic-fallback", provider: "deterministic" };
}

export async function liaProviderHealth() {
  const config = liaProviderConfig();
  const native = { configured: config.native.configured, healthy: false };
  const local = { configured: config.local.enabled, healthy: false };
  const remote = { configured: config.remote.configured, healthy: false };

  if (config.mode === "native_first" || config.mode === "native_only") {
    native.healthy = await nexoraBrainHealth();
  }

  if (config.mode !== "native_only" && config.mode !== "remote_only" && config.mode !== "deterministic_only") {
    try {
      const { ollamaHealth } = await import("@/lib/ollama/client");
      local.healthy = await ollamaHealth();
    } catch {}
  }

  remote.healthy = false;

  const selected = config.mode === "deterministic_only"
    ? "deterministic"
    : config.mode === "remote_only"
      ? (remote.configured ? "remote" : "deterministic")
      : native.healthy ? "native" : local.healthy ? "ollama" : (config.remoteFallbackExplicitlyEnabled && remote.configured ? "remote" : "deterministic");

  return { mode: config.mode, selected, native, local, remote, remoteFallbackExplicitlyEnabled: config.remoteFallbackExplicitlyEnabled };
}
