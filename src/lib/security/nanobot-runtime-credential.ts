import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { getLiaPrincipal } from "@/lib/security/agent-identity";

const PREFIX = "nbk1";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw new Error("supabase_server_configuration_missing");
  return createSupabaseAdmin(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
}

function hashCredential(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function isNanobotRuntimeCredential(value: string) {
  return value.startsWith(`${PREFIX}.`) && value.length >= 20;
}

export async function issueNanobotRuntimeCredential(userId: string, label = "NEXORA Nanobot runtime") {
  const principal = getLiaPrincipal(userId);
  const credential = `${PREFIX}.${randomBytes(32).toString("base64url")}`;
  const { data, error } = await adminClient()
    .from("lia_nanobot_runtime_credentials")
    .insert({
      user_id: userId,
      agent_id: principal.agentId,
      organization_id: principal.organizationId,
      credential_hash: hashCredential(credential),
      label: label.slice(0, 120),
    })
    .select("id,label,created_at")
    .single();

  if (error) throw new Error(`nanobot_runtime_credential_issue_failed: ${error.message}`);
  return { credential, id: data.id as string, label: data.label as string, createdAt: data.created_at as string };
}

export async function verifyNanobotRuntimeCredential(credential: string) {
  if (!isNanobotRuntimeCredential(credential)) return null;

  const hash = hashCredential(credential);
  const { data, error } = await adminClient()
    .from("lia_nanobot_runtime_credentials")
    .select("id,user_id,agent_id,organization_id,credential_hash,revoked_at")
    .eq("credential_hash", hash)
    .maybeSingle();

  if (error || !data || data.revoked_at) return null;

  const stored = Buffer.from(data.credential_hash, "hex");
  const provided = Buffer.from(hash, "hex");
  if (stored.length !== provided.length || !timingSafeEqual(stored, provided)) return null;

  void (async () => {
    try {
      await adminClient()
        .from("lia_nanobot_runtime_credentials")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", data.id);
    } catch {
      // Telemetry must never turn an otherwise valid credential into a failed request.
    }
  })();

  return {
    id: String(data.id),
    userId: String(data.user_id),
    agentId: String(data.agent_id),
    organizationId: String(data.organization_id),
  };
}

export async function revokeNanobotRuntimeCredential(userId: string, credentialId: string) {
  const { error } = await adminClient()
    .from("lia_nanobot_runtime_credentials")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", credentialId)
    .eq("user_id", userId)
    .is("revoked_at", null);
  if (error) throw new Error(`nanobot_runtime_credential_revoke_failed: ${error.message}`);
}export async function revokeNanobotRuntimeCredential(userId: string, credentialId: string) {
  const { error } = await adminClient()
    .from("lia_nanobot_runtime_credentials")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", credentialId)
    .eq("user_id", userId)
    .is("revoked_at", null);
  if (error) throw new Error(`nanobot_runtime_credential_revoke_failed: ${error.message}`);
}
