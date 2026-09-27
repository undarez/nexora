import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const apiRoot = path.join(root, "src", "app", "api");
const failures = [];
const warnings = [];
const publicRoutePatterns = [
  /\/api\/auth\//,
  /\/api\/health(?:\/|$)/,
  /\/api\/stripe\/webhook(?:\/|$)/,
  /\/api\/payments\/stripe\/webhook(?:\/|$)/,
  /\/api\/banking\/powens\/(?:webhook|callback)(?:\/|$)/,
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/^route\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const routes = walk(apiRoot);
if (!routes.length) {
  console.error("No API routes found.");
  process.exit(1);
}

for (const file of routes) {
  const rel = "/" + path.relative(root, file).replaceAll(path.sep, "/");
  const source = fs.readFileSync(file, "utf8");
  const publicRoute = publicRoutePatterns.some((pattern) => pattern.test(rel));
  const hasMcpBearerAuth = /requireBearerAuth\(|bearerGate/.test(source) && /verifyAccessToken|authInfo/.test(source);
  const hasMcpBearerAuth = /requireBearerAuth\(|bearerGate/.test(source) && /verifyAccessToken|authInfo/.test(source);
  const hasCronSecretAuth =
    /LIA_CRON_SECRET|CRON_SECRET/.test(source) &&
    /authorization/.test(source) &&
    /Bearer/.test(source) &&
    /function authorized/.test(source);
  const hasUserAuth = !hasMcpBearerAuth && !hasCronSecretAuth &&
    /auth\.getUser\(|auth\.getSession\(|getUser\(|getMobileAuth\(|requireAdmin|assertAdmin|\bcreateClient\(\)/.test(source);
  const hasAuth = hasUserAuth || hasCronSecretAuth || hasMcpBearerAuth;
  const machineToMachineMutation = (hasCronSecretAuth || hasMcpBearerAuth) && !hasUserAuth;
  const methods = [...source.matchAll(/export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]);
  const hasMutation = methods.length > 0;

  if (!publicRoute && !hasAuth) failures.push(`${rel}: no obvious authentication guard`);
  if (hasMutation && !publicRoute && !machineToMachineMutation && !/assertSameOrigin\(/.test(source)) {
    failures.push(`${rel}: state-changing route missing assertSameOrigin()`);
  }

  if (/SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|service_role/.test(source) && !/requireAdmin|assertAdmin|cron|webhook|service-role/i.test(source)) {
    warnings.push(`${rel}: service-role material requires manual authorization review`);
  }

  if (!publicRoute && /\.from\(["'](?:transactions|accounts|bank_accounts|wealth_entries|budgets|budget_lines)["']\)\.(?:insert|update|upsert|delete)\(/.test(source)) {
    failures.push(`${rel}: direct financial-table mutation from API route; use a governed server action/RPC`);
  }
}

const liaRoot = path.join(root, "src", "app", "api", "lia");
for (const file of walk(liaRoot)) {
  const rel = "/" + path.relative(root, file).replaceAll(path.sep, "/");
  const source = fs.readFileSync(file, "utf8");
  if (!publicRoutePatterns.some((pattern) => pattern.test(rel)) && /\.from\(["'](?:transactions|accounts|bank_accounts|wealth_entries)["']\)\.(?:insert|update|upsert|delete)\(/.test(source)) {
    failures.push(`${rel}: LIA route directly mutates financial source data`);
  }
}

console.log(`API security audit: scanned ${routes.length} routes`);
for (const warning of warnings) console.log(`WARN ${warning}`);
if (failures.length) {
  console.error("\nAPI security audit failures:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("API security audit: PASS");
