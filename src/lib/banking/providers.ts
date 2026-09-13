import { registerBankingProvider } from "./provider-registry";
import { powensAdapter } from "./powens-adapter";

// Keep Powens visible in the banking UI even before server credentials are configured.
// The adapter validates credentials when a connection is actually requested.
registerBankingProvider(powensAdapter);
