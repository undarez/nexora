export type SkillSandboxRequest = {
  candidateFingerprint: string;
  baselineFingerprint: string;
  content: string;
  verificationSteps: string[];
  timeoutMs?: number;
};

export type SkillSandboxResult = {
  available: boolean;
  verified: boolean;
  runId: string | null;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  trace: Record<string, unknown>;
  reason?: string;
};

const MAX_OUTPUT = 12000;

function config() {
  return {
    url: process.env.LIA_SKILL_SANDBOX_URL?.trim() || "",
    secret: process.env.LIA_SKILL_SANDBOX_SECRET?.trim() || "",
  };
}

/**
 * The application never executes candidate code itself.
 * It delegates to an isolated sandbox service and fails closed if that service
 * is not configured or does not return an explicit successful verification.
 */
export async function runSkillSandbox(request: SkillSandboxRequest): Promise<SkillSandboxResult> {
  const { url, secret } = config();
  if (!url || !secret) {
    return {
      available: false,
      verified: false,
      runId: null,
      exitCode: null,
      stdout: "",
      stderr: "",
      trace: { sandbox: "not_configured", activation_allowed: false },
      reason: "skill_sandbox_not_configured",
    };
  }

  const timeoutMs = Math.max(5_000, Math.min(120_000, Number(request.timeoutMs ?? 60_000)));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        candidateFingerprint: request.candidateFingerprint,
        baselineFingerprint: request.baselineFingerprint,
        content: request.content.slice(0, 30_000),
        verificationSteps: request.verificationSteps.slice(0, 10).map((step) => step.slice(0, 500)),
        policy: {
          network: "deny_by_default",
          secrets: "none",
          financial_writes: false,
          production_access: false,
          max_duration_ms: timeoutMs,
        },
      }),
      signal: controller.signal,
    });

    const body = await response.json().catch(() => ({}));
    const verified = response.ok && body?.verified === true && body?.activation_allowed === false;
    return {
      available: true,
      verified,
      runId: typeof body?.runId === "string" ? body.runId.slice(0, 200) : null,
      exitCode: Number.isInteger(body?.exitCode) ? body.exitCode : null,
      stdout: typeof body?.stdout === "string" ? body.stdout.slice(0, MAX_OUTPUT) : "",
      stderr: typeof body?.stderr === "string" ? body.stderr.slice(0, MAX_OUTPUT) : "",
      trace: typeof body?.trace === "object" && body.trace ? body.trace : { response_status: response.status },
      reason: verified ? undefined : "sandbox_verification_failed",
    };
  } catch (error) {
    return {
      available: true,
      verified: false,
      runId: null,
      exitCode: null,
      stdout: "",
      stderr: "",
      trace: { sandbox: "request_failed", activation_allowed: false },
      reason: error instanceof Error ? error.message.slice(0, 300) : "sandbox_request_failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

export function isSkillSandboxConfigured() {
  const { url, secret } = config();
  return Boolean(url && secret);
}
