import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { decryptVaultPayload, encryptVaultPayload, maskSensitiveLabel } from "@/lib/lia/secure-vault";
import type { BankingProviderAdapter } from "./types";
import crypto from "node:crypto";

const provider = "powens";

function config() {
  const domain = process.env.POWENS_DOMAIN?.trim();
  const clientId = process.env.POWENS_CLIENT_ID?.trim();
  const clientSecret = process.env.POWENS_CLIENT_SECRET?.trim();
  if (!domain || !clientId || !clientSecret) throw new Error("Powens non configuré côté serveur.");
  return { domain: domain.replace(/^https?:\/\//, "").replace(/\/$/, ""), clientId, clientSecret };
}

async function powensFetch(path: string, token: string, init?: RequestInit) {
  const { domain } = config();
  const response = await fetch(`https://${domain}/2.0${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const text = await response.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw new Error(`Powens API ${response.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  return body as Record<string, unknown>;
}

async function fetchPowensHref(href: string, token: string) {
  const url = new URL(href);
  const { domain } = config();
  if (url.protocol !== "https:" || url.hostname !== domain) throw new Error("URL de pagination Powens inattendue.");
  return powensFetch(`${url.pathname}${url.search}`.replace(/^\/2\.0/, ""), token);
}

async function getOrCreateUserToken(userId: string): Promise<{ token: string; idUser: number }> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("Supabase serveur indisponible.");
  const existing = await admin.from("financial_secure_vault_items")
    .select("id,ciphertext,iv,auth_tag,status")
    .eq("user_id", userId).eq("provider_ref", "powens:user").eq("status", "active")
    .order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    const payload = decryptVaultPayload(existing.data) as { token?: string; idUser?: number };
    if (typeof payload?.token === "string" && payload.token && typeof payload?.idUser === "number" && payload.idUser > 0) return { token: payload.token, idUser: payload.idUser };
  }
  const { domain, clientId, clientSecret } = config();
  const tokenResponse = await fetch(`https://${domain}/2.0/auth/init`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }), cache: "no-store",
  });
  const tokenBody = await tokenResponse.json() as { auth_token?: string; id_user?: number };
  if (!tokenResponse.ok || !tokenBody.auth_token || !tokenBody.id_user) throw new Error("Impossible de créer le contexte utilisateur Powens.");
  const encrypted = encryptVaultPayload({ token: tokenBody.auth_token, idUser: tokenBody.id_user });
  const inserted = await admin.from("financial_secure_vault_items").insert({
    user_id: userId, data_class: "bank_connection", sensitivity_level: 5,
    label: "Jeton Open Banking Powens", masked_label: maskSensitiveLabel("Jeton Open Banking Powens"),
    provider_ref: "powens:user", ciphertext: encrypted.ciphertext, iv: encrypted.iv, auth_tag: encrypted.auth_tag, key_version: encrypted.version,
  }).select("id").single();
  if (inserted.error) throw inserted.error;
  return { token: tokenBody.auth_token, idUser: tokenBody.id_user };
}

async function createWebviewUrl({ userId, workspaceId, redirectUri, connectionId, mode = "connect" }: { userId: string; workspaceId?: string | null; redirectUri: string; connectionId?: string; mode?: "connect" | "reconnect" | "manage" }) {
  const { domain, clientId } = config();
  const { token } = await getOrCreateUserToken(userId);
  const codeBody = await powensFetch(`/auth/token/code?type=singleAccess`, token);
  const code = String(codeBody.code ?? "");
  if (!code) throw new Error("Powens n'a pas fourni de code temporaire.");
  const state = crypto.randomBytes(24).toString("base64url");
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("Supabase serveur indisponible.");
  const redirect = new URL(redirectUri);
  const metadata = { oauth_state: state, redirect_uri: redirectUri, client: redirect.searchParams.get("client"), flow: mode, external_connection_id: connectionId ?? null, state_created_at: new Date().toISOString() };
  if (connectionId) {
    const existing = await admin.from("bank_connections").select("id,user_id,provider").eq("id", connectionId).eq("user_id", userId).maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) throw new Error("Connexion bancaire introuvable.");
    await admin.from("bank_connections").update({ status: "pending", metadata, updated_at: new Date().toISOString() }).eq("id", connectionId).eq("user_id", userId);
  } else {
    const pending = await admin.from("bank_connections").insert({ user_id: userId, provider, status: "pending", workspace_id: workspaceId ?? null, metadata }).select("id").single();
    if (pending.error) throw pending.error;
  }
  const flow = mode === "reconnect" ? "reconnect" : mode === "manage" ? "manage" : "connect";
  const url = new URL(`https://webview.powens.com/fr/${flow}`);
  url.searchParams.set("domain", domain);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);
  url.searchParams.set("state", state);
  url.searchParams.set("connector_capabilities", "bank");
  url.searchParams.set("account_types", "checking,card");
  if (connectionId) url.searchParams.set("connection_id", connectionId);
  return url.toString();
}

async function getConnection({ userId, connectionId }: { userId: string; connectionId: string }) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("Supabase serveur indisponible.");
  const row = await admin.from("bank_connections").select("external_connection_id").eq("id", connectionId).eq("user_id", userId).maybeSingle();
  if (row.error) throw row.error;
  if (!row.data?.external_connection_id) throw new Error("Connexion Powens non finalisée.");
  const { token } = await getOrCreateUserToken(userId);
  const body = await powensFetch(`/users/me/connections/${encodeURIComponent(row.data.external_connection_id)}?expand=connector`, token);
  return { token, externalConnectionId: String(row.data.external_connection_id), body };
}

export const powensAdapter: BankingProviderAdapter = {
  provider,
  capabilities: ["accounts", "balances", "transactions", "open_banking"],
  callbackPath: "/api/banking/powens/callback",
  createConnectionUrl: ({ userId, workspaceId, redirectUri, connectionId, mode = "connect" }) => createWebviewUrl({ userId, workspaceId, redirectUri, connectionId, mode }),
  async getConnectionState({ userId, connectionId }) {
    const { body } = await getConnection({ userId, connectionId });
    const state = body.state == null ? null : String(body.state);
    const connector = body.connector as Record<string, unknown> | undefined;
    return {
      state,
      institutionName: connector?.name ? String(connector.name) : null,
      consentExpiresAt: body.access_expire ? String(body.access_expire) : (body.expire ? String(body.expire) : null),
    };
  },
  async listAccounts({ userId, connectionId }) {
    const { token, externalConnectionId } = await getConnection({ userId, connectionId });
    const body = await powensFetch(`/users/me/connections/${encodeURIComponent(externalConnectionId)}/accounts?all`, token);
    return Array.isArray(body.accounts) ? body.accounts as Record<string, unknown>[] : [];
  },
  async activateAccounts({ userId, connectionId, externalAccountIds }) {
    const ids = externalAccountIds.map((id) => String(id).trim()).filter(Boolean);
    if (!ids.length) throw new Error("Aucun compte à activer.");
    const { token, externalConnectionId } = await getConnection({ userId, connectionId });
    await powensFetch(`/users/me/connections/${encodeURIComponent(externalConnectionId)}/accounts/${ids.map(encodeURIComponent).join(",")}?all`, token, {
      method: "PUT",
      body: JSON.stringify({ disabled: false }),
    });
  },
  async deactivateAccounts({ userId, connectionId, externalAccountIds }) {
    const ids = externalAccountIds.map((id) => String(id).trim()).filter(Boolean);
    if (!ids.length) throw new Error("Aucun compte à désactiver.");
    const { token, externalConnectionId } = await getConnection({ userId, connectionId });
    await powensFetch(`/users/me/connections/${encodeURIComponent(externalConnectionId)}/accounts/${ids.map(encodeURIComponent).join(",")}?all`, token, {
      method: "PUT",
      body: JSON.stringify({ disabled: true }),
    });
  },
  async disconnect({ userId, connectionId }) {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase serveur indisponible.");
    const row = await admin.from("bank_connections").select("external_connection_id").eq("id", connectionId).eq("user_id", userId).maybeSingle();
    if (row.error) throw row.error;
    if (!row.data?.external_connection_id) return;
    const { token } = await getOrCreateUserToken(userId);
    await powensFetch(`/users/me/connections/${encodeURIComponent(row.data.external_connection_id)}`, token, { method: "DELETE" });
  },
  async sync({ connectionId, userId }) {
    const admin = getSupabaseAdmin();
    if (!admin) throw new Error("Supabase serveur indisponible.");
    const { data: connection, error } = await admin.from("bank_connections")
      .select("external_connection_id").eq("id", connectionId).eq("user_id", userId).maybeSingle();
    if (error) throw error;
    if (!connection?.external_connection_id) throw new Error("Connexion Powens non finalisée.");
    const vault = await admin.from("financial_secure_vault_items").select("ciphertext,iv,auth_tag")
      .eq("user_id", userId).eq("provider_ref", "powens:user").eq("status", "active")
      .order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (vault.error) throw vault.error;
    if (!vault.data) throw new Error("Jeton Powens absent du coffre.");
    const secret = decryptVaultPayload(vault.data) as { token?: string };
    if (!secret.token) throw new Error("Jeton Powens invalide.");
    const token = secret.token;
    const accountsBody = await powensFetch(`/users/me/connections/${encodeURIComponent(connection.external_connection_id)}/accounts?all`, token);
    const rawAccounts = Array.isArray(accountsBody.accounts) ? accountsBody.accounts as Record<string, unknown>[] : [];
    const accounts = rawAccounts.filter((a) => !a.disabled);
    const transactions: Record<string, unknown>[] = [];
    for (const account of accounts) {
      const accountId = String(account.id ?? "");
      if (!accountId) continue;
      let next: string | null = `/users/me/accounts/${encodeURIComponent(accountId)}/transactions?limit=1000&all`;
      let pages = 0;
      while (next && pages < 50 && transactions.length < 50000) {
        const page: Record<string, unknown> = next.startsWith("http") ? await fetchPowensHref(next, token) : await powensFetch(next, token);
        if (Array.isArray(page.transactions)) {
          for (const t of page.transactions as Record<string, unknown>[]) transactions.push({ ...t, accountExternalId: accountId });
        }
        const candidate: unknown = (page as { _links?: { next?: { href?: string } } })._links?.next?.href;
        next = typeof candidate === "string" ? candidate : null;
        pages += 1;
      }
    }
    return {
      accounts: accounts.map((a) => ({
        id: a.id, name: a.name, type: a.type, currency: a.currency, balance: a.balance, availableBalance: a.available_balance ?? a.balance,
        ibanMasked: a.iban ? `••••${String(a.iban).slice(-4)}` : null,
      })),
      transactions: transactions.map((t) => ({
        id: t.id, accountExternalId: t.accountExternalId, bookedAt: t.application_date ?? t.date, valueDate: t.vdate ?? t.date,
        description: t.original_wording ?? t.wording ?? "Opération bancaire", merchantName: t.original_wording ?? null,
        amount: Number(t.value ?? 0), currency: t.currency ?? "EUR", pending: false, category: (t.category as { name?: string } | undefined)?.name ?? null,
      })).filter((t) => t.accountExternalId != null),
    };
  },
};
