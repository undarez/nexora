import { registerBankingProvider } from "./provider-registry";
import { powensAdapter } from "./powens-adapter";

// Keep Powens discoverable so the banking action is never disabled in the UI.
// The adapter validates server credentials when the connection is actually started.
registerBankingProvider(powensAdapter);
