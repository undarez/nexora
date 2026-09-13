import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parseStripeWebhookEvent, verifyStripeWebhookSignature } from "@/lib/payments/stripe-server";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Signature Stripe manquante." }, { status: 400 });
  const rawBody = await request.text();
  try {
    verifyStripeWebhookSignature(rawBody, signature);
    const event = parseStripeWebhookEvent(rawBody);
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase serveur indisponible." }, { status: 503 });

    const object = event.data?.object ?? {};
    const paymentIntentId = typeof object.id === "string" && event.type.startsWith("payment_intent.") ? object.id : null;
    const userId = typeof object.metadata === "object" && object.metadata && typeof (object.metadata as Record<string, unknown>).nexora_user_id === "string"
      ? String((object.metadata as Record<string, unknown>).nexora_user_id) : null;

    const { data: inserted, error: insertError } = await admin.from("stripe_webhook_events").insert({
      stripe_event_id: event.id, event_type: event.type, stripe_payment_intent_id: paymentIntentId, user_id: userId,
    }).select("id").maybeSingle();
    if (insertError) {
      if (String(insertError.code) === "23505") return NextResponse.json({ received: true, duplicate: true });
      throw insertError;
    }

    if (paymentIntentId) {
      const status = typeof object.status === "string" ? object.status : null;
      const amount = typeof object.amount === "number" ? object.amount : null;
      const currency = typeof object.currency === "string" ? object.currency : null;
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (status) update.status = status;
      if (amount !== null) update.amount = amount;
      if (currency) update.currency = currency;
      if (userId) update.user_id = userId;
      await admin.from("stripe_payment_intents").update(update).eq("stripe_payment_intent_id", paymentIntentId);
    }

    if (inserted?.id) await admin.from("stripe_webhook_events").update({ processed_at: new Date().toISOString() }).eq("id", inserted.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook Stripe invalide." }, { status: 400 });
  }
}
