import fs from "node:fs";
import path from "node:path";

const required = [
  "src/lib/banking/types.ts",
  "src/lib/banking/powens-adapter.ts",
  "src/lib/banking/sync-engine.ts",
  "src/app/api/banking/connect/route.ts",
  "src/app/api/banking/powens/callback/route.ts",
  "src/app/api/banking/powens/webhook/route.ts",
  "src/app/api/banking/accounts/route.ts",
  "supabase/migrations/0089_open_banking_webhooks_and_recovery.sql",
];
const missing = required.filter((file) => !fs.existsSync(path.resolve(file)));
if (missing.length) { console.error("Missing banking files:", missing); process.exit(1); }
const adapter = fs.readFileSync("src/lib/banking/powens-adapter.ts", "utf8");
const callback = fs.readFileSync("src/app/api/banking/powens/callback/route.ts", "utf8");
const webhook = fs.readFileSync("src/app/api/banking/powens/webhook/route.ts", "utf8");
const checks = [
  ["single Powens capability declaration", (adapter.match(/capabilities:/g) || []).length === 1],
  ["provider callback path", adapter.includes("/api/banking/powens/callback")],
  ["account-scoped transactions", adapter.includes("/users/me/accounts/")],
  ["pagination", adapter.includes("_links?.next?.href")],
  ["disconnect", adapter.includes(`method: "DELETE"`)],
  ["callback state expiry", callback.includes("15 * 60 * 1000")],
  ["webhook HMAC", webhook.includes(`createHmac("sha256"`)],
  ["webhook replay window", webhook.includes("5 * 60 * 1000")],
  ["webhook idempotency", webhook.includes("23505")],
  ["account activation endpoint", fs.existsSync("src/app/api/banking/accounts/route.ts") && adapter.includes("activateAccounts")],
  ["account discovery endpoint", fs.existsSync("src/app/api/banking/accounts/route.ts") && adapter.includes("listAccounts")],
  ["provider state recovery", adapter.includes("getConnectionState") && callback.includes("needs_reauth")],
];
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? "OK" : "FAIL"} ${name}`);
if (failed.length) process.exit(1);
