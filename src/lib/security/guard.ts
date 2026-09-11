import { NextResponse, type NextRequest } from "next/server";

type Counter = { count: number; resetAt: number };
const counters = new Map<string, Counter>();
const WINDOW_MS = 60_000;
const MAX_SENSITIVE_REQUESTS = 60;

function clientKey(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  // One budget per client across all protected routes prevents rotating endpoints
  // to bypass a per-path counter. A real deployment should add edge/WAF limiting.
  return ip;
}

export function suspiciousRequest(request: NextRequest) {
  let decoded = `${request.nextUrl.pathname}?${request.nextUrl.search}`.toLowerCase();
  try { decoded = decodeURIComponent(decoded); } catch { return true; }
  return [
    decoded.includes("\\0"), decoded.includes("../"), decoded.includes("..\\"),
    decoded.includes("/.env"), decoded.includes("/.git"), decoded.includes("wp-admin"), decoded.includes("phpmyadmin"),
  ].some(Boolean);
}

export function securityGuard(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const sensitive = pathname.startsWith("/api/") || pathname.startsWith("/admin");
  if (!sensitive) return null;

  const key = clientKey(request);
  const now = Date.now();
  const current = counters.get(key);
  const next = !current || current.resetAt <= now
    ? { count: 1, resetAt: now + WINDOW_MS }
    : { count: current.count + 1, resetAt: current.resetAt };
  counters.set(key, next);

  // Prevent unbounded growth on long-lived Node processes.
  if (counters.size > 10_000) {
    for (const [k, v] of counters) if (v.resetAt <= now) counters.delete(k);
  }

  if (next.count > MAX_SENSITIVE_REQUESTS) {
    return NextResponse.json(
      { error: "Trop de requêtes. Accès temporairement bloqué.", code: "SECURITY_RATE_LIMIT" },
      { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } },
    );
  }
  return null;
}
