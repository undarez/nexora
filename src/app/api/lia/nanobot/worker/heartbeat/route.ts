import { NextResponse } from "next/server";
import {
  verifyNanobotRuntimeCredential,
} from "@/lib/security/nanobot-runtime-credential";
import {
  recordNanobotWorkerHeartbeat,
} from "@/lib/security/nanobot-worker-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearer(request: Request) {
  const value = request.headers.get("authorization")?.trim();
  if (!value?.startsWith("Bearer ")) return null;
  return value.slice("Bearer ".length).trim();
}

export async function POST(request: Request) {
  try {
    const credential = bearer(request);
    if (!credential) return NextResponse.json({ error: "authorization_required" }, { status: 401 });

    const identity = await verifyNanobotRuntimeCredential(credential);
    if (!identity) return NextResponse.json({ error: "invalid_or_revoked_credential" }, { status: 401 });

    let body: unknown = {};
    try { body = await request.json(); } catch {}

    const workerKey = typeof (body as { workerKey?: unknown })?.workerKey === "string"
      ? (body as { workerKey: string }).workerKey.trim()
      : "";
    if (!workerKey) return NextResponse.json({ error: "worker_key_required" }, { status: 400 });

    const status = (body as { status?: unknown })?.status;
    const allowedStatus = status === "ready" || status === "error" || status === "draining"
      ? status
      : undefined;

    const result = await recordNanobotWorkerHeartbeat({
      credentialId: identity.id,
      workerKey,
      status: allowedStatus,
      errorCode: typeof (body as { errorCode?: unknown })?.errorCode === "string"
        ? (body as { errorCode: string }).errorCode
        : null,
    });

    return NextResponse.json({ ok: true, worker: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "nanobot_worker_heartbeat_failed" },
      { status: 503 },
    );
  }
}
