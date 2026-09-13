/** Governance for durable LIA memory used as conversational context. */

const SENSITIVE_KEY = /(password|passwd|secret|token|access[_-]?token|refresh[_-]?token|authorization|api[_-]?key|iban|bic|card[_-]?(number|pan|cvv|cvc)|bank[_-]?account[_-]?(number|id)|provider[_-]?payload)/i;

export type LiaMemoryPolicy = {
  eligible: boolean;
  personalization: boolean;
  reason: string;
};

export function classifyLiaMemory(input: {
  memoryType?: string | null;
  sourceKind?: string | null;
  topic?: string | null;
}): LiaMemoryPolicy {
  const personalization = input.sourceKind === "user_request"
    || input.memoryType === "strategic"
    || input.memoryType === "procedural";
  if (personalization) return { eligible: true, personalization: true, reason: "personalization" };
  return { eligible: true, personalization: false, reason: "non_personal_context" };
}

export function sanitizeMemoryValue(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 40).map((item) => sanitizeMemoryValue(item, depth + 1));
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(key)) continue;
      output[key] = sanitizeMemoryValue(child, depth + 1);
    }
    return output;
  }
  if (typeof value === "string") return value.slice(0, 1800);
  return value;
}

export function canActivatePersonalization(args: {
  consentedPersonalization: boolean;
  status: string;
  explicitUserRequest: boolean;
}): boolean {
  return args.consentedPersonalization === true
    && args.status === "accepted"
    && args.explicitUserRequest === true;
}
