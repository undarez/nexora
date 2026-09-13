import type { BankAccountType, NormalizedBankAccount, NormalizedBankTransaction } from "./types";

const accountTypes: BankAccountType[] = ["checking", "savings", "card", "investment", "loan", "other"];

function normalizeCurrency(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim().toUpperCase();
  if (typeof value === "object" && value !== null) {
    const currency = value as Record<string, unknown>;
    const candidate = currency.code ?? currency.currency ?? currency.iso_code ?? currency.isoCode ?? currency.id;
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim().toUpperCase();
  }
  return "EUR";
}

function normalizeCategory(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "object") {
    const category = value as Record<string, unknown>;
    const name = category.name ?? category.label ?? category.id;
    return typeof name === "string" && name.trim() ? name.trim() : null;
  }
  return null;
}

export function normalizeAccount(input: Record<string, unknown>, provider: string): NormalizedBankAccount {
  const rawType = String(input.accountType ?? input.type ?? "other").toLowerCase();
  const accountType = accountTypes.includes(rawType as BankAccountType) ? rawType as BankAccountType : "other";
  return {
    provider,
    externalAccountId: String(input.externalAccountId ?? input.id ?? ""),
    name: String(input.name ?? "Compte bancaire"),
    accountType,
    ibanMasked: input.ibanMasked == null ? null : String(input.ibanMasked),
    currency: normalizeCurrency(input.currency),
    balance: input.balance == null ? null : Number(input.balance),
    availableBalance: input.availableBalance == null ? null : Number(input.availableBalance),
  };
}

export function normalizeTransaction(input: Record<string, unknown>, provider: string): NormalizedBankTransaction {
  return {
    provider,
    externalTransactionId: String(input.externalTransactionId ?? input.id ?? ""),
    bookedAt: String(input.bookedAt ?? input.date ?? ""),
    valueDate: input.valueDate == null ? null : String(input.valueDate),
    description: String(input.description ?? "Opération bancaire"),
    merchantName: input.merchantName == null ? null : String(input.merchantName),
    amount: Number(input.amount ?? 0),
    currency: normalizeCurrency(input.currency),
    pending: Boolean(input.pending ?? false),
    category: normalizeCategory(input.category),
  };
}
