import { randomBytes, randomUUID } from "node:crypto";
import { getLiaPrincipal } from "@/lib/security/agent-identity";
import { issueNanobotRuntimeCredential, revokeNanobotRuntimeCredential } from "@/lib/security/nanobot-runtime-credential";
import { registerNanobotWorker, type NanobotWorker } from "@/lib/security/nanobot-worker-registry";

type ProvisionResponse = {
  endpointUrl: string;
  workspaceRef: string;
  configRef: string;
  workerKey?: string;
};

const WORKER_ENVIRONMENTS = new Set(["development", "staging", "production"] as const);\n\nfunction supervisorConfig() {
  const url = process.env.NEXORA_NANOBOT_SUPERVISOR_URL?.trim().replace(/\/$/, "");
  const token = process.env.NEXORA_NANOBOT_SUPERVISOR_TOKEN?.trim();
  if (!url || !token) throw new Error("nanobot_supervisor_not_configured");
  return { url, token };
}

async function supervisorRequest<T>(path: string, body: Record<string, unknown>, timeoutMs = 30_000): Promise<T> {
  const { url, token } = supervisorConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${url}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(`nanobot_supervisor_http_${response.status}`);
    let payload: unknown;
    try { payload = JSON.parse(raw); } catch { throw new Error("nanobot_supervisor_invalid_json"); }
    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function provisionNanobotWorkerForUser(userId: string): Promise<NanobotWorker> {
  const principal = getLiaPrincipal(userId);
  const issued = await issueNanobotRuntimeCredential(userId, "NEXORA isolated Nanobot worker");

  const workerKey = `nbw1.${randomBytes(24).toString("base64url")}`;
  const sessionNamespace = `nexora:${principal.organizationId}:${principal.agentId}:${randomUUID()}`;
  const request = {
    workerKey,
    userId,
    agentId: principal.agentId,
    organizationId: principal.organizationId,
    environment: workerEnvironment(),
    workspaceIsolation: "per-user",
    workspaceRef: `nexora-workspace:${userId}:${randomUUID()}`,
    configRef: `nexora-config:${userId}:${randomUUID()}`,
    sessionNamespace,
    restrictToWorkspace: true,
    maxConcurrency: 2,
    requestTimeoutMs: 120_000,
    nexoraMcpUrl: process.env.NEXORA_MCP_URL ?? `${process.env.NEXT_PUBLIC_APP_URL}/api/mcp`,
    runtimeCredential: issued.credential,
  };

  try {
    const provisioned = await supervisorRequest<ProvisionResponse>("/v1/workers/provision", request);
    if (!provisioned.endpointUrl || !provisioned.workspaceRef || !provisioned.configRef) {
      throw new Error("nanobot_supervisor_incomplete_provision_response");
    }

    return await registerNanobotWorker({
      userId,
      credentialId: issued.id,
      agentId: principal.agentId,
      organizationId: principal.organizationId,
      workerKey,
      endpointUrl: provisioned.endpointUrl,
      workspaceRef: provisioned.workspaceRef,
      configRef: provisioned.configRef,
      sessionNamespace,
      environment: request.environment,
    });
  } catch (error) {
    await revokeNanobotRuntimeCredential(userId, issued.id).catch(() => undefined);
    throw error;
  }
}
