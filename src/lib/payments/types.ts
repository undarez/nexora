export type StripePaymentCapability =
  | "payment_intents"
  | "checkout"
  | "billing"
  | "refunds"
  | "webhooks"
  | "customers"
  | "payment_methods"
  | "setup_intents"
  | "sepa_debit";

export type StripePaymentIntentInput = {
  amount: number;
  currency: string;
  userId: string;
  customerId?: string;
  description?: string;
  metadata?: Record<string, string>;
  idempotencyKey: string;
};

export type StripePaymentIntent = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  client_secret?: string | null;
};

export type StripeWebhookEvent = {
  id: string;
  type: string;
  created?: number;
  data?: { object?: Record<string, unknown> };
};
