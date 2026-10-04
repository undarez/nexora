import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { getNanobotWorkerRecordForUser } from "@/lib/security/nanobot-worker-registry";
import { provisionNanobotWorkerForUser } from "@/lib/security/nanobot-worker-supervisor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

    const existing = await getNanobotWorkerForUser(user.id);
    if (existing) {
      return NextResponse.json({ ok: true, worker: { id: existing.id, status: existing.status } });
    }

    const worker = await provisionNanobotWorkerForUser(user.id);
    return NextResponse.json({
      ok: true,
      worker: { id: worker.id, status: worker.status, environment: worker.environment },
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "nanobot_worker_provision_failed" },
      { status: 503 },
    );
  }
}
