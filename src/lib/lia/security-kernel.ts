export type LiaSecurityDecision = "allow" | "deny" | "human_review";

const PRIVATE_HOST = /^(localhost|127\.|0\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/i;
const MAX_GOAL_LENGTH = 1600;
const MAX_WEB_BYTES = 750_000;

export function validateAutonomousGoal(goal: string): { ok: boolean; reason?: string } {
  if (!goal.trim()) return { ok: false, reason: "empty_goal" };
  if (goal.length > MAX_GOAL_LENGTH) return { ok: false, reason: "goal_too_long" };
  return { ok: true };
}

export function classifyLiaCapability(args: {
  capability: string;
  risk: "read" | "write" | "financial" | "security" | "unknown";
  autonomous: boolean;
}): LiaSecurityDecision {
  if (!args.autonomous) return "allow";
  if (args.capability === "research_web" && args.risk === "read") return "allow";
  if (args.risk === "read") return "allow";
  return "human_review";
}

export function validateWebTarget(urlString: string): { ok: boolean; reason?: string } {
  try {
    const url = new URL(urlString);
    if (url.protocol !== "https:") return { ok: false, reason: "https_required" };
    if (url.username || url.password) return { ok: false, reason: "credentials_in_url" };
    if (PRIVATE_HOST.test(url.hostname)) return { ok: false, reason: "private_or_local_host" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
}

export function webLimits() {
  return { maxBytes: MAX_WEB_BYTES, maxRedirects: 3, timeoutMs: 12_000 };
}

/** Never allow memory, web content, or model output to grant a capability. */
export function memoryCannotAuthorize(): true { return true; }
