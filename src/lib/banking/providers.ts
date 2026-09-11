import { registerBankingProvider } from "./provider-registry";
import { powensAdapter } from "./powens-adapter";

if (process.env.POWENS_DOMAIN && process.env.POWENS_CLIENT_ID && process.env.POWENS_CLIENT_SECRET) {
  registerBankingProvider(powensAdapter);
}
