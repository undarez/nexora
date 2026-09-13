import { registerBankingProvider } from "./provider-registry";
import { powensAdapter } from "./powens-adapter";

// Powens accepte un domaine du type "client.biapi.pro". Normalise aussi
// les valeurs fréquemment saisies dans Vercel (.biapi.pro, https://..., /2.0).
// Cela évite de construire des URLs API du type /2.0/2.0/... qui provoquent un 404.
const rawPowensDomain = process.env.POWENS_DOMAIN?.trim();
if (rawPowensDomain) {
  try {
    const parsed = new URL(/^https?:\/\//i.test(rawPowensDomain) ? rawPowensDomain : `https://${rawPowensDomain}`);
    let hostname = parsed.hostname.replace(/\.biapi\.pro$/i, "");
    if (hostname) process.env.POWENS_DOMAIN = `${hostname}.biapi.pro`;
  } catch {
    const hostname = rawPowensDomain
      .replace(/^https?:\/\//i, "")
      .split(/[/?#]/, 1)[0]
      .replace(/\.biapi\.pro$/i, "");
    if (hostname) process.env.POWENS_DOMAIN = `${hostname}.biapi.pro`;
  }
}

registerBankingProvider(powensAdapter);
