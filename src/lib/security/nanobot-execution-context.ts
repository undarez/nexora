import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

const TOKEN_PREFIX = "nbx1";
const AUDIENCE = "nexora-mcp";
const DEFAULT_TTL_MS = 60_000;

export type NanobotExecutionContext = {
  version: 1;
  audience: typeof AUDIENCE;
  userId: string;
  agentId: string;
  organizationId: string;
  goalId: string | null;
  runId: string | null;
  sessionId: string;
  autonomyLevel: number;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

function getBridgeSecret() {
  const secret = process.env.NEXORA_NANOBOT_BRIDGE_SECRET;
  if (!secret || secret.length < 32) throw new Error("nanobot_bridge_secret_missing_or_weak");
  return secret;
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function sign(encodedPayload: string) {
  return createHmac("sha256", getBridgeSecret()).update(encodedPayload).digest("base64url");
}

function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw new Error("supabase_server_configuration_missing");
  return createSupabaseAdmin(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function mintNanobotExecutionContext(input: {
  userId: string;
  agentId: string;
  organizationId: string;
  goalId?: string | null;
  runId?: string | null;
  sessionId: string;
  autonomyLevel: number;
  ttlMs?: number;
}) {
  if (!input.userId || !input.agentId || !input.organizationId || !input.sessionId) throw new Error("nanobot_execution_context_identity_missing");
  if (!Number.isInteger(input.autonomyLevel) || input.autonomyLevel < 0 || input.autonomyLevel > 8) throw new Error("nanobot_execution_context_autonomy_invalid");

  const now = Date.now();
  const ttlMs = Math.min(Math.max(input.ttlMs ?? DEFAULT_TTL_MS, 10_000), 120_000);
  const context: NanobotExecutionContext = {
    version: 1,
    audience: AUDIENCE,
    userId: input.userId,
    agentId: input.agentId,
    organizationId: input.organizationId,
    goalId: input.goalId ?? null,
    runId: input.runId ?? null,
    sessionId: input.sessionId,
    autonomyLevel: input.autonomyLevel,
    issuedAt: Math.floor(now / 1000),
    expiresAt: Math.floor((now + ttlMs) / 1000),
    nonce: randomUUID(),
  };

  const encoded = encode(context);
  const token = `${TOKEN_PREFIX}.${encoded}.${sign(encoded)}`;
  const { error } = await adminClient().from("lia_nanobot_execution_contexts").insert({
    nonce: context.nonce,
    token_hash: hashToken(token),
    user_id: context.userId,
    agent_id: context.agentId,
    organization_id: context.organizationId,
    goal_id: context.goalId,
    run_id: context.runId,
    session_id: context.sessionId,
    autonomy_level: context.autonomyLevel,
    issued_at: new Date(context.issuedAt * 1000).toISOString(),
    expires_at: new Date(context.expiresAt * 1000).toISOString(),
  });
  if (error) throw new Error(`nanobot_execution_context_persist_failed: ${error.message}`);

  return { token, context };
}

export async function verifyNanobotExecutionContext(token: string): Promise<NanobotExecutionContext | null> {
  if (!token.startsWith(`${TOKEN_PREFIX}.`)) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return null;

  const encoded = parts[1];
  const providedSignature = parts[2];
  const expectedSignature = sign(encoded);
  const provided = Buffer.from(providedSignature, "base64url");
  const expected = Buffer.from(expectedSignature, "base64url");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  let context: NanobotExecutionContext;
  try {
    context = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as NanobotExecutionContext;
  } catch {
    return null;
  }

  if (
    context.version !== 1 ||
    context.audience !== AUDIENCE ||
    !context.userId ||
    !context.agentId ||
    !context.organizationId ||
    !context.sessionId ||
    !context.nonce ||
    !Number.isInteger(context.autonomyLevel) ||
    context.autonomyLevel < 0 ||
    context.autonomyLevel > 8
  ) return null;

  const now = Math.floor(Date.now() / 1000);
  if (context.issuedAt > now + 30 || context.expiresAt <= now || context.expiresAt <= context.issuedAt) return null;

  const { data, error } = await adminClient()
    .from("lia_nanobot_execution_contexts")
    .select("nonce,token_hash,user_id,agent_id,organization_id,goal_id,run_id,session_id,autonomy_level,expires_at,revoked_at")
    .eq("nonce", context.nonce)
    .maybeSingle();

  if (error || !data || data.revoked_at || new Date(data.expires_at).getTime() <= Date.now()) return null;
  if (data.token_hash !== hashToken(token)) return null;
  if (data.user_id !== context.userId || data.agent_id !== context.agentId || data.organization_id !== context.organizationId || data.session_id !== context.sessionId) return null;
  if (Number(data.autonomy_level) !== context.autonomyLevel) return null;

  return context;
}
