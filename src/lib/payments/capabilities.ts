import type { StripePaymentCapability } from "./types";

export const STRIPE_PAYMENT_CAPABILITIES: readonly StripePaymentCapability[] = [
  "customers", "payment_methods", "setup_intents", "payment_intents", "sepa_debit", "refunds", "webhooks", "checkout", "billing",
] as const;

export function supportsStripePaymentCapability(capability: string): capability is StripePaymentCapability {
  return (STRIPE_PAYMENT_CAPABILITIES as readonly string[]).includes(capability);
}
