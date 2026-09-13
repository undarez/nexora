import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { syncBankConnection } from "@/lib/banking/sync-engine";
import "@/lib/banking/providers";

const secret = () => process.env.POWENS_WEBHOOK_SECRET?.trim() ?? "";

function validSignature(request: Request, rawBody: string) {
  const key = secret();
  if (!key) return false;
  const date = request.headers.get("BI-Signature-Date") ?? "";
  const provided = request.headers.get("BI-Signature") ?? "";
  if (!date || !provided) return false;
  const ts = Date.parse(date);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 5 * 60 * 1000) return false;
  const endpoint = new URL(request.url).pathname;
  const material = `POST.${endpoint}.${date}.${rawBody}`;
  const expected = crypto.createHmac("sha256", key).update(material).digest("base64");
  const a = Buffer.from(expected); const b = Buffer.from(provided);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!validSignature(request, rawBody)) return NextResponse.json({ error: "Signature webhook invalide." }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase serveur indisponible." }, { status: 503 });
  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "Payload webhook invalide." }, { status: 400 }); }
  const webhookDataId = String(payload.id_webhook_data ?? "");
  if (!webhookDataId) return NextResponse.json({ error: "id_webhook_data manquant." }, { status: 400 });
  const eventType = String(payload.event ?? payload.type ?? payload.event_type ?? "unknown");
  const externalConnectionId = payload.connection?.id != null ? String(payload.connection.id) : null;
  const externalUserId = payload.user?.id != null ? String(payload.user.id) : null;
  const inserted = await admin.from("bank_webhook_events").insert({ provider: "powens", webhook_data_id: webhookDataId, event_type: eventType, external_connection_id: externalConnectionId, external_user_id: externalUserId, status: "received" });
  if (inserted.error) {
    if (inserted.error.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
    return NextResponse.json({ error: inserted.error.message }, { status: 500 });
  }
  if (!externalConnectionId || !["CONNECTION_SYNCED", "ACCOUNT_SYNCED", "ACCOUNTS_FETCHED", "ACCOUNT_CATEGORIZED", "ACCOUNT_FOUND", "ACCOUNT_ENABLED", "ACCOUNT_DISABLED", "CONNECTION_DELETED"].includes(eventType)) {
    await admin.from("bank_webhook_events").update({ status: "ignored", processed_at: new Date().toISOString() }).eq("provider", "powens").eq("webhook_data_id", webhookDataId);
    return NextResponse.json({ ok: true, ignored: true });
  }
  const { data: connection } = await admin.from("bank_connections").select("id,user_id").eq("provider", "powens").eq("external_connection_id", externalConnectionId).maybeSingle();
  if (!connection) {
    await admin.from("bank_webhook_events").update({ status: "ignored", error_message: "Connexion NEXORA introuvable.", processed_at: new Date().toISOString() }).eq("provider", "powens").eq("webhook_data_id", webhookDataId);
    return NextResponse.json({ ok: true, ignored: true });
  }
  try {
    if (eventType === "CONNECTION_DELETED") {
      const now = new Date().toISOString();
      await admin.from("bank_connections").update({ status: "revoked", updated_at: now }).eq("id", connection.id).eq("user_id", connection.user_id);
      await admin.from("bank_accounts").update({ status: "revoked", access_revoked_at: now, updated_at: now }).eq("connection_id", connection.id).eq("user_id", connection.user_id);
      await admin.from("bank_webhook_events").update({ status: "processed", processed_at: now }).eq("provider", "powens").eq("webhook_data_id", webhookDataId);
      return NextResponse.json({ ok: true, revoked: true });
    }
    const externalAccountId = payload.account?.id != null ? String(payload.account.id) : null;
    if (eventType === "ACCOUNT_DISABLED" || eventType === "ACCOUNT_ENABLED") {
      if (externalAccountId) {
        const now = new Date().toISOString();
        await admin.from("bank_accounts").update({
          status: eventType === "ACCOUNT_DISABLED" ? "disabled" : "active",
          access_revoked_at: eventType === "ACCOUNT_DISABLED" ? now : null,
          updated_at: now,
        }).eq("connection_id", connection.id).eq("user_id", connection.user_id).eq("external_account_id", externalAccountId);
      }
    }
    await syncBankConnection({ supabase: admin, userId: connection.user_id, connectionId: connection.id });
    await admin.from("bank_webhook_events").update({ status: "processed", processed_at: new Date().toISOString() }).eq("provider", "powens").eq("webhook_data_id", webhookDataId);
    return NextResponse.json({ ok: true, processed: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Synchronisation webhook impossible.";
    await admin.from("bank_webhook_events").update({ status: "failed", error_message: message.slice(0, 1000) }).eq("provider", "powens").eq("webhook_data_id", webhookDataId);
    return NextResponse.json({ error: "Webhook reçu mais synchronisation différée." }, { status: 202 });
  }
}
