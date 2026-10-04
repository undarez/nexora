import { randomUUID } from "node:crypto";
import type { NanobotWorker } from "@/lib/security/nanobot-worker-registry";

export type NanobotChatResult = {
  content: string;
  model: string | null;
  usage: Record<string, unknown> | null;
  requestId: string;
  sessionId: string;
  delegated: boolean;
  fallback: boolean;
  errorCode?: string;
};

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_RESPONSE_BYTES = 2_000_000;

function config() {
  const apiKey = process.env.NANOBOT_API_KEY?.trim();
  if (!apiKey) throw new Error("nanobot_api_key_missing");
  return { apiKey };
}

function fallback(requestId: string, sessionId: string, errorCode: string): NanobotChatResult {
  return {
    content: "Le worker Nanobot isolé est momentanément indisponible. NEXORA conserve le contrôle de LIA et peut poursuivre via son runtime natif.",
    model: null,
    usage: null,
    requestId,
    sessionId,
    delegated: false,
    fallback: true,
    errorCode,
  };
}

function responseText(payload: unknown) {
  const choices = (payload as { choices?: Array<{ message?: { content?: unknown } }> })?.choices;
  const content = choices?.[0]?.message?.content;
  return typeof content === "string" ? content.slice(0, 100_000) : "";
}

function resolveWorkerEndpoint(worker: NanobotWorker | null) {
  if (worker?.endpointUrl) return worker.endpointUrl.replace(/\/$/, "");
  if (process.env.NODE_ENV !== "production" && process.env.NANOBOT_ALLOW_SHARED_RUNTIME === "true") {
    const baseUrl = process.env.NANOBOT_API_URL?.trim().replace(/\/$/, "");
    if (baseUrl) return baseUrl;
  }
  throw new Error("nanobot_worker_unavailable");
}

export async function runNanobotChat(input: {
  message: string;
  sessionId: string;
  worker?: NanobotWorker | null;
  timeoutMs?: number;
  allowFallback?: boolean;
}): Promise<NanobotChatResult> {
  const requestId = randomUUID();
  const sessionId = input.sessionId.slice(0, 160);

  try {
    const { apiKey } = config();
    const baseUrl = resolveWorkerEndpoint(input.worker ?? null);
    const timeoutMs = Math.min(
      Math.max(input.worker?.requestTimeoutMs ?? input.timeoutMs ?? DEFAULT_TIMEOUT_MS, 5_000),
      180_000,
    );
    const namespacedSessionId = input.worker
      ? `${input.worker.sessionNamespace}:${sessionId}`.slice(0, 240)
      : sessionId;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "X-NEXORA-Request-ID": requestId,
          "X-NEXORA-Worker-Key": input.worker?.workerKey ?? "development-shared-runtime",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: input.message.slice(0, 12_000) }],
          session_id: namespacedSessionId,
          stream: false,
        }),
        signal: controller.signal,
        cache: "no-store",
      });

      const contentLength = Number(response.headers.get("content-length") ?? 0);
      if (contentLength > MAX_RESPONSE_BYTES) throw new Error("nanobot_response_too_large");
      const raw = await response.text();
      if (new TextEncoder().encode(raw).byteLength > MAX_RESPONSE_BYTES) throw new Error("nanobot_response_too_large");
      if (!response.ok) throw new Error(`nanobot_http_${response.status}`);

      let payload: unknown;
      try {
        payload = JSON.parse(raw);
      } catch {
        throw new Error("nanobot_invalid_json");
      }

      const content = responseText(payload);
      if (!content) throw new Error("nanobot_empty_response");

      const typed = payload as { model?: unknown; usage?: Record<string, unknown> };
      return {
        content,
        model: typeof typed.model === "string" ? typed.model : null,
        usage: typed.usage ?? null,
        requestId,
        sessionId,
        delegated: true,
        fallback: false,
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const code = error instanceof Error && error.name === "AbortError"
      ? "nanobot_timeout"
      : error instanceof Error
        ? error.message.slice(0, 120)
        : "nanobot_unavailable";
    if (input.allowFallback !== false) return fallback(requestId, sessionId, code);
    throw new Error(code);
  }
}
