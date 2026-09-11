export type SecurityDecision = "allow" | "rate_limit" | "session_eject";
export type SecuritySignal = {
  code: "path_probe" | "sensitive_file_probe" | "invalid_session" | "rate_limit";
  severity: "high" | "critical";
  reason: string;
};
export function evaluateSecurity(input: {
  authenticated: boolean;
  pathname: string;
  search: string;
  requestCountInWindow: number;
  maxRequestsPerWindow: number;
}) {
  const raw = decodeURIComponent(`${input.pathname}?${input.search}`).toLowerCase();
  const signals: SecuritySignal[] = [];
  if (raw.includes("../") || raw.includes("..\\")) signals.push({
    code: "path_probe", severity: "critical", reason: "Path traversal probe detected."
  });
  if (raw.includes("/.env") || raw.includes("/.git") || raw.includes("wp-admin") || raw.includes("phpmyadmin")) signals.push({
    code: "sensitive_file_probe", severity: "critical", reason: "Sensitive resource probe detected."
  });
  if (!input.authenticated && (raw.startsWith("/api/") || raw.startsWith("/admin"))) signals.push({
    code: "invalid_session", severity: "high", reason: "Protected resource requested without authentication."
  });
  if (input.requestCountInWindow > input.maxRequestsPerWindow) signals.push({
    code: "rate_limit", severity: "high", reason: "Sensitive request rate exceeded."
  });
  if (signals.some(s => s.severity === "critical"))
    return { decision: "session_eject" as const, signals };
  if (signals.some(s => s.code === "rate_limit"))
    return { decision: input.authenticated ? "rate_limit" as const : "session_eject" as const, signals, retryAfterSeconds: 60 };
  return { decision: "allow" as const, signals };
}
