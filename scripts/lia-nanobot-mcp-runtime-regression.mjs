import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => readFileSync(path.join(root, p), "utf8");

const credential = read("src/lib/security/nanobot-runtime-credential.ts");
const client = read("src/lib/lia/nanobot/client.ts");
const chatRoute = read("src/app/api/lia/nanobot/chat/route.ts");
const credentialRoute = read("src/app/api/lia/nanobot/credential/route.ts");
const mcpRoute = read("src/app/api/mcp/route.ts");
const migration = read("supabase/migrations/20261004090000_lia_nanobot_runtime_credentials.sql");

assert.match(credential, /randomBytes\(32\)/);
assert.match(credential, /credential_hash/);
assert.match(credential, /revoked_at/);
assert.match(credential, /timingSafeEqual/);
assert.match(credentialRoute, /issueNanobotRuntimeCredential/);
assert.match(credentialRoute, /revokeNanobotRuntimeCredential/);
assert.match(chatRoute, /assertSameOrigin/);
assert.match(chatRoute, /supabase\.auth\.getUser/);
assert.match(client, /AbortController/);
assert.match(client, /MAX_RESPONSE_BYTES/);
assert.match(client, /X-NEXORA-Request-ID/);
assert.match(client, /session_id/);
assert.match(client, /fallback/);
assert.match(mcpRoute, /isNanobotRuntimeCredential/);
assert.match(mcpRoute, /verifyNanobotRuntimeCredential/);
assert.match(mcpRoute, /mintNanobotExecutionContext/);
assert.match(mcpRoute, /get_lia_autonomy/);
assert.match(mcpRoute, /nexora-nanobot-runtime/);
assert.match(migration, /enable row level security/);
assert.match(migration, /revoke all on public\.lia_nanobot_runtime_credentials from anon, authenticated/);

console.log("Nanobot MCP runtime adapter regression: PASS");
