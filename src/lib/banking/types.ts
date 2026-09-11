export type BankConnectionStatus =
  | "pending"
  | "active"
  | "needs_reauth"
  | "error"
  | "revoked"
  | "disconnected";

export type BankAccountType =
  | "checking"
  | "savings"
  | "card"
  | "investment"
  | "loan"
  | "other";

export type BankingCapability =
  | "accounts"
  | "balances"
  | "transactions"
  | "identity"
  | "open_banking";

export type NormalizedBankAccount = {
  provider: string;
  externalAccountId: string;
  name: string;
  accountType: BankAccountType;
  ibanMasked?: string | null;
  currency: string;
  balance?: number | null;
  availableBalance?: number | null;
};

export type NormalizedBankTransaction = {
  provider: string;
  externalTransactionId: string;
  bookedAt: string;
  valueDate?: string | null;
  description: string;
  merchantName?: string | null;
  amount: number;
  currency: string;
  pending?: boolean;
  category?: string | null;
};

export type BankingProviderAdapter = {
  provider: string;
  capabilities: readonly BankingCapability[];
  createConnectionUrl?: (input: { userId: string; workspaceId?: string | null; redirectUri: string; connectionId?: string; mode?: "connect" | "reconnect" | "manage" }) => Promise<string>;
  callbackPath?: string;
  disconnect?: (input: { userId: string; connectionId: string }) => Promise<void>;
  sync?: (input: { connectionId: string; userId: string }) => Promise<{
    accounts: Record<string, unknown>[];
    transactions: Record<string, unknown>[];
  }>;
  listAccounts?: (input: { connectionId: string; userId: string }) => Promise<Array<Record<string, unknown>>>;
  activateAccounts?: (input: { connectionId: string; userId: string; externalAccountIds: string[] }) => Promise<void>;
  deactivateAccounts?: (input: { connectionId: string; userId: string; externalAccountIds: string[] }) => Promise<void>;
  getConnectionState?: (input: { connectionId: string; userId: string }) => Promise<{ state: string | null; institutionName?: string | null; consentExpiresAt?: string | null }>;
};
