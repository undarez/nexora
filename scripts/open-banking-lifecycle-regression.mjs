import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const checks = [
  ["callback consumes oauth state", /oauth_state: null/.test(read("src/app/api/banking/powens/callback/route.ts"))],
  ["callback records state consumption", /state_consumed_at/.test(read("src/app/api/banking/powens/callback/route.ts"))],
  ["connect route uses provider callbackPath", /adapter\.callbackPath/.test(read("src/app/api/banking/connect/route.ts"))],
  ["sync delegates expired-consent gate", /enforceReconnectDeadline/.test(read("src/lib/banking/sync-engine.ts")) && /consent_expired/.test(read("src/lib/banking/lifecycle.ts"))],
  ["revocation route exists", fs.existsSync(path.join(root,"src/app/api/banking/accounts/route.ts"))],
  ["webhook handles connection deletion", /CONNECTION_DELETED/.test(read("src/app/api/banking/powens/webhook/route.ts"))],
  ["migration exists", fs.existsSync(path.join(root,"supabase/migrations/0091_open_banking_lifecycle_hardening.sql"))],
];
let failed = 0;
for (const [name, ok] of checks) { console.log(`${ok ? "OK" : "FAIL"} ${name}`); if (!ok) failed++; }
process.exitCode = failed ? 1 : 0;
