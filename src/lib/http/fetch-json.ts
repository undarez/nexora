export class AppRequestError extends Error {
  readonly status?: number;
  readonly code: "timeout" | "network" | "http" | "invalid_response";

  constructor(message: string, code: AppRequestError["code"], status?: number) {
    super(message);
    this.name = "AppRequestError";
    this.code = code;
    this.status = status;
  }
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 12_000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const raw = await response.text();
    let data: unknown = null;
    if (raw) {
      try { data = JSON.parse(raw); } catch {
        throw new AppRequestError("Le serveur a renvoyé une réponse invalide.", "invalid_response", response.status);
      }
    }
    if (!response.ok) {
      const message =
        typeof data === "object" && data && "error" in data && typeof (data as { error?: unknown }).error === "string"
          ? (data as { error: string }).error
          : `La requête a échoué (${response.status}).`;
      throw new AppRequestError(message, "http", response.status);
    }
    return data as T;
  } catch (error) {
    if (error instanceof AppRequestError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new AppRequestError("La requête a dépassé le délai prévu. Réessayez.", "timeout");
    }
    throw new AppRequestError("Connexion impossible. Vérifiez votre réseau puis réessayez.", "network");
  } finally {
    clearTimeout(timer);
  }
}
