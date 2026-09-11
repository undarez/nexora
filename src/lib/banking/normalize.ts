import type { BankAccountType, NormalizedBankAccount, NormalizedBankTransaction } from "./types";

const accountTypes: BankAccountType[] = ["checking", "savings", "card", "investment", "loan", "other"];

export function normalizeAccount(input: Record<string, unknown>, provider: string): NormalizedBankAccount {
  const rawType = String(input.accountType ?? input.type ?? "other").toLowerCase();
  const accountType = accountTypes.includes(rawType as BankAccountType) ? rawType as BankAccountType : "other";
  return {
    provider,
    externalAccountId: String(input.externalAccountId ?? input.id ?? ""),
    name: String(input.name ?? "Compte bancaire"),
    accountType,
    ibanMasked: input.ibanMasked == null ? null : String(input.ibanMasked),
    currency: String(input.currency ?? "EUR"),
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
    currency: String(input.currency ?? "EUR"),
    pending: Boolean(input.pending ?? false),
    category: input.category == null ? null : String(input.category),
  };
}
