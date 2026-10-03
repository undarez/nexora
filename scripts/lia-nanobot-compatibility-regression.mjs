import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const failures = [];

const architecture = read("docs/project/ARCHITECTURE-TARGET.md");
const mcpRoute = read("src/app/api/mcp/route.ts");
const mcpServer = read("src/lib/mcp/nexora-server.ts");
const executor = read("src/lib/agent-runtime/executor.ts");
const chatRuntime = read("src/lib/lia/chat-runtime.ts");

for (const [content, needle, label] of [
  [architecture, "generic agent runtime orchestrates capabilities", "generic runtime boundary"],
  [mcpRoute, 'requiredScopes: ["mcp"]', "MCP scope"],
  [mcpRoute, "auth.getUser(token)", "MCP identity validation"],
  [mcpRoute, 'legacy: "reject"', "legacy MCP transport rejection"],
  [mcpServer, "executeAgentTool", "MCP policy-gated execution"],
  [executor, "authorizeAgentTool", "server-side tool authorization"],
  [executor, "authorize_lia_tool", "Supabase policy authority"],
  [chatRuntime, "maxWallTimeMs: 120_000", "bounded chat tool runtime"],
]) {
  if (!content.includes(needle)) failures.push(label);
}

if (architecture.includes("Nanobot memory is the single general-purpose agent-memory runtime")) {
  failures.push("Nanobot architecture boundary unexpectedly already present on main; audit branch should record this separately");
}

if (failures.length) {
  console.error("Nanobot compatibility regression failures:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("Nanobot compatibility boundary regression: PASS");
