import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const route = read("src/app/api/mcp/route.ts");
const server = read("src/lib/mcp/nexora-server.ts");
const metadata = read("src/app/.well-known/oauth-protected-resource/route.ts");
const docs = read("src/app/docs/mcp/page.tsx");

const required = [
  [route, 'requiredScopes: ["mcp"]', "MCP scope enforcement"],
  [route, "auth.getUser(token)", "Supabase token identity validation"],
  [route, 'legacy: "reject"', "legacy transport rejection"],
  [server, '_meta: { securitySchemes: [{ type: "oauth2", scopes: ["mcp"] }] }', "per-tool OAuth compatibility metadata"],
  [server, "get_financial_snapshot", "financial snapshot tool"],
  [server, "research_web", "governed web research tool"],
  [server, "learn_skill", "candidate skill learning tool"],
  [server, "create_recommendation", "gated recommendation tool"],
  [metadata, "authorization_servers", "OAuth authorization server metadata"],
  [metadata, 'scopes_supported: ["mcp"]', "MCP scope metadata"],
  [docs, "/api/mcp", "MCP endpoint documentation"],
];

const failures = [];
for (const [content, needle, label] of required) {
  if (!content.includes(needle)) failures.push(label);
}

if (failures.length) {
  console.error("MCP connector regression failures:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("MCP connector regression: PASS");
