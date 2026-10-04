import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { runNanobotChat } from "@/lib/lia/nanobot/client";
import { getNanobotWorkerForUser } from "@/lib/security/nanobot-worker-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: "Supabase n'est pas configuré." }, { status: 503 });

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON invalide." }, { status: 400 }); }

    const message = typeof (body as { message?: unknown })?.message === "string"
      ? (body as { message: string }).message.trim().slice(0, 12_000)
      : "";
    if (!message) return NextResponse.json({ error: "message_required" }, { status: 400 });

    const sessionId = typeof (body as { sessionId?: unknown })?.sessionId === "string"
      ? (body as { sessionId: string }).sessionId.trim().slice(0, 160)
      : `nexora:${user.id}`;

    const worker = await getNanobotWorkerForUser(user.id);
    const result = await runNanobotChat({
      message,
      sessionId,
      worker,
      allowFallback: true,
    });

    return NextResponse.json({
      ...result,
      worker: worker
        ? {
            id: worker.id,
            status: worker.status,
            environment: worker.environment,
            workerKey: worker.workerKey,
          }
        : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "nanobot_request_failed" },
      { status: 503 },
    );
  }
}
