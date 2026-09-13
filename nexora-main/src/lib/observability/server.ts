import { randomUUID } from "node:crypto";

export type DiagnosticLevel = "info" | "warn" | "error";

export function diagnosticId() {
  return randomUUID();
}

export function logDiagnostic(level: DiagnosticLevel, event: string, fields: Record<string, unknown> = {}) {
  const payload = {
    ts: new Date().toISOString(),
    event,
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(`[diagnostic] ${line}`);
  else if (level === "warn") console.warn(`[diagnostic] ${line}`);
  else console.info(`[diagnostic] ${line}`);
}

export function errorInfo(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { name: "UnknownError", message: String(error) };
}
