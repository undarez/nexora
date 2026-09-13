/** V5.08.49 — LIA data governance and privacy boundary.
 * Classification is policy metadata, not a substitute for RLS/authentication.
 * Model-facing payloads are minimized and sensitive identifiers are redacted.
 */
export type LiaDataClass = "financial" | "personal" | "sensitive" | "memory" | "mail_metadata" | "knowledge" | "context";
export type LiaDataDisposition = "model_allowed" | "server_only" | "admin_only" | "retained_metadata";

export type LiaGovernedField = {
  key: string;
  classification: LiaDataClass;
  disposition: LiaDataDisposition;
  rationale: string;
};

const KEY_RULES: Array<[RegExp, LiaDataClass, LiaDataDisposition]> = [
  [/(password|secret|token|authorization|cookie|ciphertext|auth_tag|refresh_token|access_token|private_key)/i, "sensitive", "server_only"],
  [/(iban|bic|card|account_number|routing|provider_ref|connection_id)/i, "financial", "server_only"],
  [/(email|phone|address|birth|dob|full_name|name)/i, "personal", "model_allowed"],
  [/(memory|preference|instruction)/i, "memory", "model_allowed"],
  [/(mail|gmail|outlook)/i, "mail_metadata", "model_allowed"],
  [/(knowledge|evidence|source)/i, "knowledge", "model_allowed"],
];

export function classifyLiaField(key: string): LiaGovernedField {
  const normalized = String(key);
  const rule = KEY_RULES.find(([pattern]) => pattern.test(normalized));
  if (rule) return { key: normalized, classification: rule[1], disposition: rule[2], rationale: `Règle de classification ${rule[1]}.` };
  return { key: normalized, classification: "context", disposition: "model_allowed", rationale: "Champ contextuel non identifié comme secret ou identifiant sensible." };
}

function redactString(value: string) {
  return value
    .replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/gi, "[IBAN_REDACTED]")
    .replace(/\b\d{13,19}\b/g, "[NUMBER_REDACTED]")
    .slice(0, 2000);
}

export function governLiaPayload(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[DEPTH_LIMIT]";
  if (typeof value === "string") return redactString(value);
  if (typeof value !== "object" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => governLiaPayload(item, depth + 1));
  const output: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const field = classifyLiaField(key);
    if (field.disposition === "server_only" || field.disposition === "admin_only") continue;
    output[key] = governLiaPayload(raw, depth + 1);
  }
  return output;
}

export const LIA_DATA_GOVERNANCE = {
  version: 1,
  sourceOfTruth: "financial_data",
  modelRules: [
    "Les données financières servent de source de vérité pour les faits financiers.",
    "Les identifiants financiers et secrets restent côté serveur.",
    "Les métadonnées mail sont des signaux et non des preuves comptables.",
    "La mémoire ne constitue ni une donnée financière de référence ni une autorisation.",
    "Les connaissances externes sont des éléments de contexte et doivent conserver leur provenance.",
    "Les payloads envoyés au modèle sont minimisés selon leur finalité.",
  ],
  retention: {
    financial: "governed_by_financial_records_and_user_workspace_policy",
    mail_metadata: "connection_lifecycle_and_provider_policy",
    memory: "memory_expiration_and_user_controls",
    knowledge: "source_status_and_versioning",
    audit: "audit_policy_and_legal_requirements",
  },
} as const;
