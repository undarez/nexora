import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createStripePaymentIntent } from "@/lib/payments/stripe-server";

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête cross-origin refusée." }, { status: 403 }); }
  try {
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: "Supabase indisponible." }, { status: 503 });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const body = await request.json().catch(() => ({})) as {
      amount?: number; currency?: string; description?: string; customerId?: string;
      metadata?: Record<string, string>; idempotencyKey?: string;
    };
    if (!body.idempotencyKey || typeof body.idempotencyKey !== "string") return NextResponse.json({ error: "idempotencyKey requis." }, { status: 400 });
    if (body.customerId && typeof body.customerId !== "string") return NextResponse.json({ error: "customerId invalide." }, { status: 400 });
    if (body.metadata && (typeof body.metadata !== "object" || Array.isArray(body.metadata))) return NextResponse.json({ error: "metadata invalide." }, { status: 400 });

    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase serveur indisponible." }, { status: 503 });
    const existing = await admin.from("stripe_payment_intents")
      .select("stripe_payment_intent_id,status,amount,currency,client_secret")
      .eq("user_id", user.id).eq("idempotency_key", body.idempotencyKey).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return NextResponse.json({ provider: "stripe", capability: "payment_intents", paymentIntent: { id: existing.data.stripe_payment_intent_id, status: existing.data.status, amount: Number(existing.data.amount), currency: existing.data.currency, client_secret: existing.data.client_secret }, reused: true });
    if (body.customerId) {
      const ownedCustomer = await admin.from("stripe_customers").select("stripe_customer_id").eq("user_id", user.id).eq("stripe_customer_id", body.customerId).maybeSingle();
      if (ownedCustomer.error) throw ownedCustomer.error;
      if (!ownedCustomer.data) return NextResponse.json({ error: "Customer Stripe hors périmètre utilisateur." }, { status: 403 });
    }

    const paymentIntent = await createStripePaymentIntent({
      amount: Number(body.amount), currency: String(body.currency ?? "eur"), userId: user.id,
      customerId: body.customerId, description: typeof body.description === "string" ? body.description.slice(0, 500) : undefined,
      metadata: body.metadata, idempotencyKey: body.idempotencyKey,
    });

    const inserted = await admin.from("stripe_payment_intents").insert({
      user_id: user.id, stripe_payment_intent_id: paymentIntent.id, idempotency_key: body.idempotencyKey,
      status: paymentIntent.status, amount: paymentIntent.amount, currency: paymentIntent.currency,
      client_secret: paymentIntent.client_secret ?? null, metadata: body.metadata ?? {},
    });
    if (inserted.error) throw inserted.error;

    return NextResponse.json({ provider: "stripe", capability: "payment_intents", paymentIntent, reused: false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Paiement Stripe impossible." }, { status: 500 });
  }
}
