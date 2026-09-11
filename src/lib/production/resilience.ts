export class ProductionDependencyError extends Error {
  readonly dependency: string;
  readonly retryable: boolean;
  constructor(dependency: string, message: string, retryable = true) {
    super(message);
    this.name = "ProductionDependencyError";
    this.dependency = dependency;
    this.retryable = retryable;
  }
}

export function safeErrorMessage(error: unknown, fallback = "Une erreur temporaire est survenue.") {
  if (error instanceof ProductionDependencyError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, dependency: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new ProductionDependencyError(dependency, `Le service ${dependency} met trop de temps à répondre.`, true)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
