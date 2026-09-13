import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertSameOrigin } from "@/lib/security/csrf";
import { createStripeCustomer, createStripeCheckoutSession } from "@/lib/payments/stripe-server";
import { resolveEntitlement } from "@/lib/billing/entitlements";

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Requête cross-origin refusée." }, { status: 403 }); }
  try {
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: "Supabase indisponible." }, { status: 503 });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "Supabase serveur indisponible." }, { status: 503 });
    const entitlement = await resolveEntitlement({ supabase, admin, userId: user.id, email: user.email });
    if (entitlement.plan === "premium") return NextResponse.json({ error: entitlement.isAdmin ? "Le compte administrateur dispose déjà de Premium gratuitement." : "Votre abonnement Premium est déjà actif." }, { status: 409 });
    const priceId = process.env.STRIPE_PREMIUM_PRICE_ID?.trim();
    if (!priceId) return NextResponse.json({ error: "STRIPE_PREMIUM_PRICE_ID n'est pas configuré." }, { status: 503 });
    const existing = await admin.from("stripe_customers").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
    let customerId = existing.data?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await createStripeCustomer({ userId: user.id, email: user.email, idempotencyKey: `nexora-customer-${user.id}` });
      customerId = customer.id;
      const insert = await admin.from("stripe_customers").insert({ user_id: user.id, stripe_customer_id: customer.id, email: customer.email ?? user.email ?? null, name: customer.name ?? null });
      if (insert.error && String(insert.error.code) !== "23505") throw insert.error;
    }
    const origin = new URL(request.url).origin;
    const session = await createStripeCheckoutSession({ customerId, userId: user.id, priceId, successUrl: `${origin}/tarifs?checkout=success`, cancelUrl: `${origin}/tarifs?checkout=cancelled`, idempotencyKey: `nexora-checkout-${user.id}-${Date.now()}` });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Checkout Premium indisponible." }, { status: 500 });
  }
}
