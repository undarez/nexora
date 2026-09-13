import type { BankingProviderAdapter } from "./types";

/**
 * Provider-neutral registry. No banking provider is enabled until its adapter
 * is explicitly implemented and configured server-side.
 */
const adapters = new Map<string, BankingProviderAdapter>();

export function registerBankingProvider(adapter: BankingProviderAdapter) {
  adapters.set(adapter.provider, adapter);
}

export function getBankingProvider(provider: string) {
  return adapters.get(provider) ?? null;
}

export function listBankingProviders() {
  return Array.from(adapters.keys());
}


export function findBankingProvidersByCapability(capability: import("./types").BankingCapability) {
  return Array.from(adapters.values()).filter((adapter) => adapter.capabilities.includes(capability));
}
