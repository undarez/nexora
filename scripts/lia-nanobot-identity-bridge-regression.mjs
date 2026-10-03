import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => readFileSync(path.join(root, p), "utf8");

const context = read("src/lib/security/nanobot-execution-context.ts");
const mcpRoute = read("src/app/api/mcp/route.ts");
const executor = read("src/lib/agent-runtime/executor.ts");
const migration = read("supabase/migrations/20261003090000_lia_nanobot_execution_context.sql");

assert.match(context, /createHmac\("sha256"/);
assert.match(context, /timingSafeEqual/);
assert.match(context, /randomUUID/);
assert.match(context, /expiresAt/);
assert.match(context, /nonce/);
assert.match(context, /token_hash/);
assert.match(context, /revoked_at/);
assert.match(context, /autonomyLevel/);
assert.match(mcpRoute, /verifyNanobotExecutionContext/);
assert.match(mcpRoute, /getLiaPrincipal/);
assert.match(mcpRoute, /SUPABASE_SECRET_KEY/);
assert.match(mcpRoute, /executionContext/);
assert.match(mcpRoute, /agent_identity_mismatch/);
assert.match(executor, /autonomyCeiling/);
assert.match(executor, /Math\.min\(autonomyLevel, governanceContext\.autonomyCeiling\)/);
assert.match(migration, /enable row level security/);
assert.match(migration, /revoke all on public\.lia_nanobot_execution_contexts from anon, authenticated/);

console.log("Nanobot identity bridge regression: PASS");
