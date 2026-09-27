import { NextResponse } from "next/server";
import "@/lib/banking/providers";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { syncBankConnection } from "@/lib/banking/sync-engine";

type SyncSummary = {
  connectionId: string;
  status: "completed" | "skipped" | "failed";
  synced: boolean;
  accountsUpserted: number;
  transactionsUpserted: number;
  reason?: string;
};

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Requête cross-origin refusée." },
      { status: 403 }
    );
  }

  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase indisponible." }, { status: 503 });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const { data: connections, error } = await supabase
      .from("bank_connections")
      .select("id,status")
      .eq("user_id", user.id)
      .eq("status", "active");

    if (error) throw error;

    const results: SyncSummary[] = [];

    // This is the single user-facing synchronization path shared by
    // /banque and /dashboard. Provider credentials and payloads stay server-side.
    for (const connection of connections ?? []) {
      const connectionId = String(connection.id);

      try {
        const result = await syncBankConnection({
          supabase,
          userId: user.id,
          connectionId,
        });

        results.push({
          connectionId,
          status: result.synced ? "completed" : "skipped",
          synced: result.synced,
          accountsUpserted: result.accountsUpserted,
          transactionsUpserted: result.transactionsUpserted,
          reason: result.reason,
        });
      } catch (error) {
        results.push({
          connectionId,
          status: "failed",
          synced: false,
          accountsUpserted: 0,
          transactionsUpserted: 0,
          reason: error instanceof Error ? error.message : "Synchronisation impossible.",
        });
      }
    }

    const failed = results.filter((item) => item.status === "failed");
    const synced = results.filter((item) => item.synced);

    return NextResponse.json(
      {
        synced: failed.length === 0 && results.every((item) => item.synced || item.status === "skipped"),
        connectionCount: results.length,
        syncedCount: synced.length,
        failedCount: failed.length,
        results,
        rawCredentialsExposed: false,
        rawProviderPayloadExposed: false,
      },
      { status: failed.length > 0 && synced.length === 0 ? 502 : 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Synchronisation bancaire impossible.",
        synced: false,
        rawCredentialsExposed: false,
      },
      { status: 500 }
    );
  }
}
