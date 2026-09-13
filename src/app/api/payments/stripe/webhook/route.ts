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

    const object = (event.data?.object ?? {}) as Record<string, any>;
    const paymentIntentId = typeof object.id === "string" && event.type.startsWith("payment_intent.") ? object.id : null;
    const userId = typeof object.metadata === "object" && object.metadata && typeof (object.metadata as Record<string, unknown>).nexora_user_id === "string" ? String((object.metadata as Record<string, unknown>).nexora_user_id) : null;
    const { data: inserted, error: insertError } = await admin.from("stripe_webhook_events").insert({ stripe_event_id: event.id, event_type: event.type, stripe_payment_intent_id: paymentIntentId, user_id: userId }).select("id").maybeSingle();
    if (insertError) { if (String(insertError.code) === "23505") return NextResponse.json({ received: true, duplicate: true }); throw insertError; }

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

    if (event.type.startsWith("customer.subscription.")) {
      const customerId = typeof object.customer === "string" ? object.customer : null;
      const subscriptionId = typeof object.id === "string" ? object.id : null;
      let resolvedUserId = userId;
      if (!resolvedUserId && customerId) {
        const customer = await admin.from("stripe_customers").select("user_id").eq("stripe_customer_id", customerId).maybeSingle();
        resolvedUserId = customer.data?.user_id ? String(customer.data.user_id) : null;
      }
      if (resolvedUserId && customerId && subscriptionId) {
        const item = Array.isArray(object.items?.data) ? object.items.data[0] : null;
        const priceId = typeof item?.price?.id === "string" ? item.price.id : null;
        const periodEnd = typeof object.current_period_end === "number" ? new Date(object.current_period_end * 1000).toISOString() : null;
        const subscriptionWrite = await admin.from("billing_subscriptions").upsert({ user_id: resolvedUserId, stripe_customer_id: customerId, stripe_subscription_id: subscriptionId, stripe_price_id: priceId, status: typeof object.status === "string" ? object.status : "inactive", current_period_end: periodEnd, cancel_at_period_end: Boolean(object.cancel_at_period_end), updated_at: new Date().toISOString() }, { onConflict: "stripe_subscription_id" });
        if (subscriptionWrite.error) throw subscriptionWrite.error;
      }
    }

    if (event.type === "checkout.session.completed") {
      const customerId = typeof object.customer === "string" ? object.customer : null;
      const checkoutUserId = typeof object.metadata === "object" && object.metadata && typeof (object.metadata as Record<string, unknown>).nexora_user_id === "string" ? String((object.metadata as Record<string, unknown>).nexora_user_id) : userId;
      if (checkoutUserId && customerId && typeof object.subscription === "string") {
        const subscriptionWrite = await admin.from("billing_subscriptions").upsert({ user_id: checkoutUserId, stripe_customer_id: customerId, stripe_subscription_id: String(object.subscription), status: "active", updated_at: new Date().toISOString() }, { onConflict: "stripe_subscription_id" });
        if (subscriptionWrite.error) throw subscriptionWrite.error;
      }
    }

    if (inserted?.id) await admin.from("stripe_webhook_events").update({ processed_at: new Date().toISOString() }).eq("id", inserted.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook Stripe invalide." }, { status: 400 });
  }
}
