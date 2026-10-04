import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => readFileSync(path.join(root, p), "utf8");

const chatRoute = read("src/app/api/lia/nanobot/chat/route.ts");
const credential = read("src/lib/security/nanobot-runtime-credential.ts");
const credentialRoute = read("src/app/api/lia/nanobot/credential/route.ts");
const context = read("src/lib/security/nanobot-execution-context.ts");
const mcpRoute = read("src/app/api/mcp/route.ts");
const executor = read("src/lib/agent-runtime/executor.ts");
const contract = read("docs/integrations/nanobot-production-isolation.md");

assert.match(chatRoute, /supabase\.auth\.getUser/);
assert.match(chatRoute, /runNanobotChat/);
assert.doesNotMatch(chatRoute, /body.*userId|body.*organizationId/);

assert.match(credential, /getLiaPrincipal\(userId\)/);
assert.match(credential, /credential_hash/);
assert.match(credential, /revoked_at/);
assert.match(credentialRoute, /supabase\.auth\.getUser/);
assert.match(credentialRoute, /issueNanobotRuntimeCredential/);
assert.match(credentialRoute, /revokeNanobotRuntimeCredential/);

assert.match(context, /createHmac\("sha256"/);
assert.match(context, /expiresAt/);
assert.match(context, /autonomyLevel/);
assert.match(context, /token_hash/);

assert.match(mcpRoute, /verifyNanobotRuntimeCredential/);
assert.match(mcpRoute, /mintNanobotExecutionContext/);
assert.match(mcpRoute, /agent_identity_mismatch/);
assert.match(mcpRoute, /autonomyLevel/);

assert.match(executor, /Math\.min\(configuredAutonomyLevel, autonomyCeiling\)/);
assert.match(executor, /authorize_lia_tool/);
assert.match(executor, /Decision Gate/);

assert.match(contract, /MUST NOT use one shared Nanobot workspace/);
assert.match(contract, /session_id.*not.*authorization boundary/i);
assert.match(contract, /distinct NEXORA runtime credential/);

console.log("Nanobot production isolation regression: PASS");
