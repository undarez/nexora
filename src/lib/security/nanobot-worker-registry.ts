import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { getLiaPrincipal } from "@/lib/security/agent-identity";

type WorkerStatus = "provisioning" | "ready" | "draining" | "disabled" | "error";

export type NanobotWorker = {
  id: string;
  userId: string;
  agentId: string;
  organizationId: string;
  credentialId: string;
  workerKey: string;
  environment: "development" | "staging" | "production";
  status: WorkerStatus;
  desiredState: "running" | "stopped";
  endpointUrl: string | null;
  workspaceRef: string;
  configRef: string;
  sessionNamespace: string;
  restrictToWorkspace: boolean;
  maxConcurrency: number;
  requestTimeoutMs: number;
  lastHeartbeatAt: string | null;
  failureCount: number;
  lastErrorCode: string | null;
};

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw new Error("supabase_server_configuration_missing");
  return createSupabaseAdmin(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
}

function mapWorker(row: Record<string, unknown>): NanobotWorker {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    agentId: String(row.agent_id),
    organizationId: String(row.organization_id),
    credentialId: String(row.credential_id),
    workerKey: String(row.worker_key),
    environment: row.environment as NanobotWorker["environment"],
    status: row.status as WorkerStatus,
    desiredState: row.desired_state as NanobotWorker["desiredState"],
    endpointUrl: typeof row.endpoint_url === "string" ? row.endpoint_url : null,
    workspaceRef: String(row.workspace_ref),
    configRef: String(row.config_ref),
    sessionNamespace: String(row.session_namespace),
    restrictToWorkspace: Boolean(row.restrict_to_workspace),
    maxConcurrency: Number(row.max_concurrency),
    requestTimeoutMs: Number(row.request_timeout_ms),
    lastHeartbeatAt: typeof row.last_heartbeat_at === "string" ? row.last_heartbeat_at : null,
    failureCount: Number(row.failure_count),
    lastErrorCode: typeof row.last_error_code === "string" ? row.last_error_code : null,
  };
}

export async function getNanobotWorkerForUser(userId: string): Promise<NanobotWorker | null> {
  const principal = getLiaPrincipal(userId);
  const { data, error } = await adminClient()
    .from("lia_nanobot_workers")
    .select("*")
    .eq("user_id", userId)
    .eq("agent_id", principal.agentId)
    .eq("organization_id", principal.organizationId)
    .eq("desired_state", "running")
    .eq("status", "ready")
    .maybeSingle();

  if (error) throw new Error(`nanobot_worker_lookup_failed: ${error.message}`);
  return data ? mapWorker(data) : null;
}

export async function registerNanobotWorker(input: {
  userId: string;
  credentialId: string;
  agentId: string;
  organizationId: string;
  workerKey: string;
  endpointUrl: string;
  workspaceRef: string;
  configRef: string;
  sessionNamespace: string;
  environment?: "development" | "staging" | "production";
}) {
  const { data, error } = await adminClient()
    .from("lia_nanobot_workers")
    .insert({
      user_id: input.userId,
      agent_id: input.agentId,
      organization_id: input.organizationId,
      credential_id: input.credentialId,
      worker_key: input.workerKey,
      endpoint_url: input.endpointUrl,
      workspace_ref: input.workspaceRef,
      config_ref: input.configRef,
      session_namespace: input.sessionNamespace,
      environment: input.environment ?? "production",
      status: "ready",
      desired_state: "running",
      last_started_at: new Date().toISOString(),
      last_heartbeat_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw new Error(`nanobot_worker_register_failed: ${error.message}`);
  return mapWorker(data);
}

export async function markNanobotWorkerError(workerId: string, errorCode: string) {
  const { error } = await adminClient()
    .from("lia_nanobot_workers")
    .update({
      status: "error",
      last_error_code: errorCode.slice(0, 160),
      failure_count: (await getFailureCount(workerId)) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workerId);
  if (error) throw new Error(`nanobot_worker_error_update_failed: ${error.message}`);
}

async function getFailureCount(workerId: string) {
  const { data, error } = await adminClient()
    .from("lia_nanobot_workers")
    .select("failure_count")
    .eq("id", workerId)
    .single();
  if (error) throw new Error(`nanobot_worker_failure_lookup_failed: ${error.message}`);
  return Number(data.failure_count);
}

export async function recordNanobotWorkerHeartbeat(input: {
  credentialId: string;
  workerKey: string;
  status?: Extract<WorkerStatus, "ready" | "error" | "draining">;
  errorCode?: string | null;
}) {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    last_heartbeat_at: now,
    updated_at: now,
  };
  if (input.status) patch.status = input.status;
  if (input.errorCode !== undefined) patch.last_error_code = input.errorCode?.slice(0, 160) ?? null;

  const { data, error } = await adminClient()
    .from("lia_nanobot_workers")
    .update(patch)
    .eq("credential_id", input.credentialId)
    .eq("worker_key", input.workerKey)
    .select("id,status,last_heartbeat_at")
    .maybeSingle();

  if (error) throw new Error(`nanobot_worker_heartbeat_failed: ${error.message}`);
  if (!data) throw new Error("nanobot_worker_not_found");
  return data;
}
