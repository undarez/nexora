import crypto from "node:crypto";
import type { StripePaymentIntent, StripePaymentIntentInput, StripeWebhookEvent } from "./types";

const STRIPE_API = "https://api.stripe.com/v1";
const WEBHOOK_TOLERANCE_SECONDS = 300;

function secretKey() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("Stripe non configuré côté serveur.");
  if (!/^sk_(test|live)_/.test(key)) throw new Error("STRIPE_SECRET_KEY invalide.");
  return key;
}

function webhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret || !/^whsec_/.test(secret)) throw new Error("STRIPE_WEBHOOK_SECRET non configuré ou invalide.");
  return secret;
}

function encodeForm(input: Record<string, string | undefined>) {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) if (value !== undefined) form.set(key, value);
  return form;
}

async function stripeFetch(path: string, form: URLSearchParams, idempotencyKey?: string) {
  const response = await fetch(`${STRIPE_API}${path}`, { method: "POST", headers: { Authorization: `Bearer ${secretKey()}`, "Content-Type": "application/x-www-form-urlencoded", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) }, body: form, cache: "no-store" });
  const text = await response.text(); let body: any = null; try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) { const message = body?.error?.message ?? (typeof body === "string" ? body : "Erreur Stripe."); throw new Error(`Stripe API ${response.status}: ${message}`); }
  return body;
}

export async function createStripePaymentIntent(input: StripePaymentIntentInput): Promise<StripePaymentIntent> {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new Error("Le montant Stripe doit être un entier positif en unité mineure.");
  const currency = input.currency.trim().toLowerCase();
  if (!/^[a-z]{3}$/.test(currency)) throw new Error("Devise Stripe invalide.");
  if (!/^[A-Za-z0-9._:-]{8,255}$/.test(input.idempotencyKey)) throw new Error("Clé d'idempotence Stripe invalide.");
  const metadata = { ...(input.metadata ?? {}), nexora_user_id: input.userId };
  const form = encodeForm({ amount: String(input.amount), currency, customer: input.customerId, description: input.description, ...Object.fromEntries(Object.entries(metadata).map(([key, value]) => [`metadata[${key}]`, value])) });
  return stripeFetch("/payment_intents", form, input.idempotencyKey);
}

function safeEqualHex(a: string, b: string) { try { const aa = Buffer.from(a, "hex"); const bb = Buffer.from(b, "hex"); return aa.length === bb.length && crypto.timingSafeEqual(aa, bb); } catch { return false; } }
export function verifyStripeWebhookSignature(rawBody: string, signatureHeader: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  const parts = signatureHeader.split(","); const timestamp = Number(parts.find((part) => part.startsWith("t="))?.slice(2)); const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!Number.isFinite(timestamp) || signatures.length === 0) throw new Error("Signature Stripe invalide.");
  if (Math.abs(nowSeconds - timestamp) > WEBHOOK_TOLERANCE_SECONDS) throw new Error("Webhook Stripe hors fenêtre de tolérance.");
  const expected = crypto.createHmac("sha256", webhookSecret()).update(`${timestamp}.${rawBody}`).digest("hex");
  if (!signatures.some((candidate) => safeEqualHex(candidate, expected))) throw new Error("Signature Stripe invalide.");
}
export function parseStripeWebhookEvent(rawBody: string): StripeWebhookEvent { let event: StripeWebhookEvent; try { event = JSON.parse(rawBody) as StripeWebhookEvent; } catch { throw new Error("Payload webhook Stripe invalide."); } if (!event || typeof event.id !== "string" || typeof event.type !== "string") throw new Error("Événement Stripe invalide."); return event; }

export type StripeCustomerRecord = { id: string; email?: string | null; name?: string | null };
export type StripeSetupIntent = { id: string; status: string; client_secret?: string | null; customer?: string | null; payment_method?: string | null };
export type StripeRefund = { id: string; status: string; amount: number; currency: string; payment_intent?: string | null; charge?: string | null };
export async function createStripeCustomer(input: { userId: string; email?: string | null; name?: string | null; idempotencyKey: string }): Promise<StripeCustomerRecord> { if (!/^[A-Za-z0-9._:-]{8,255}$/.test(input.idempotencyKey)) throw new Error("Clé d'idempotence Stripe invalide."); const metadata = { nexora_user_id: input.userId }; return stripeFetch("/customers", encodeForm({ email: input.email ?? undefined, name: input.name ?? undefined, ...Object.fromEntries(Object.entries(metadata).map(([k,v]) => [`metadata[${k}]`,v])) }), input.idempotencyKey); }
export async function createStripeSetupIntent(input: { customerId: string; userId: string; paymentMethodTypes?: string[]; idempotencyKey: string }): Promise<StripeSetupIntent> { const types = input.paymentMethodTypes?.length ? input.paymentMethodTypes : ["sepa_debit"]; const form = encodeForm({ customer: input.customerId, usage: "off_session", ...Object.fromEntries(types.map((type, i) => [`payment_method_types[${i}]`, type])), "metadata[nexora_user_id]": input.userId }); return stripeFetch("/setup_intents", form, input.idempotencyKey); }
export async function retrieveStripePaymentMethod(paymentMethodId: string) { if (!/^pm_[A-Za-z0-9]+$/.test(paymentMethodId)) throw new Error("PaymentMethod Stripe invalide."); const response = await fetch(`${STRIPE_API}/payment_methods/${encodeURIComponent(paymentMethodId)}`, { headers: { Authorization: `Bearer ${secretKey()}` }, cache: "no-store" }); const text = await response.text(); let body:any=null; try { body=text?JSON.parse(text):null } catch { body=text } if (!response.ok) throw new Error(`Stripe API ${response.status}: ${body?.error?.message ?? "Erreur Stripe."}`); return body; }
export async function createStripeRefund(input: { paymentIntentId: string; userId: string; amount?: number; reason?: string; idempotencyKey: string }): Promise<StripeRefund> { if (!/^pi_[A-Za-z0-9]+$/.test(input.paymentIntentId)) throw new Error("PaymentIntent Stripe invalide."); const form = encodeForm({ payment_intent: input.paymentIntentId, amount: input.amount !== undefined ? String(input.amount) : undefined, reason: input.reason, "metadata[nexora_user_id]": input.userId }); return stripeFetch("/refunds", form, input.idempotencyKey); }

export type StripeCheckoutSession = { id: string; url: string; status?: string | null; subscription?: string | null };
export async function createStripeCheckoutSession(input: { customerId: string; userId: string; priceId: string; successUrl: string; cancelUrl: string; idempotencyKey: string }): Promise<StripeCheckoutSession> {
  if (!/^cus_[A-Za-z0-9]+$/.test(input.customerId)) throw new Error("Client Stripe invalide.");
  if (!/^price_[A-Za-z0-9]+$/.test(input.priceId)) throw new Error("Prix Stripe Premium invalide.");
  if (!/^https?:\/\//.test(input.successUrl) || !/^https?:\/\//.test(input.cancelUrl)) throw new Error("URLs Stripe invalides.");
  if (!/^[A-Za-z0-9._:-]{8,255}$/.test(input.idempotencyKey)) throw new Error("Clé d'idempotence Stripe invalide.");
  const form = encodeForm({ mode: "subscription", customer: input.customerId, success_url: input.successUrl, cancel_url: input.cancelUrl, "line_items[0][price]": input.priceId, "line_items[0][quantity]": "1", allow_promotion_codes: "true", "metadata[nexora_user_id]": input.userId, "subscription_data[metadata][nexora_user_id]": input.userId });
  return stripeFetch("/checkout/sessions", form, input.idempotencyKey);
}
