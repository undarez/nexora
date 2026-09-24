import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const migrationsDir = path.join(root, "supabase", "migrations");

if (!fs.existsSync(migrationsDir)) {
  throw new Error("supabase/migrations directory is missing");
}

const sqlFiles = fs
  .readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

if (sqlFiles.length === 0) {
  throw new Error("No Supabase migrations found");
}

const failures = [];
let securityDefinerCount = 0;

for (const file of sqlFiles) {
  const fullPath = path.join(migrationsDir, file);
  const sql = fs.readFileSync(fullPath, "utf8");

  const definerMatches = sql.match(/SECURITY\s+DEFINER/gi) ?? [];
  securityDefinerCount += definerMatches.length;

  if (definerMatches.length > 0) {
    const functionBlocks = sql.split(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/gi).slice(1);

    for (const block of functionBlocks) {
      const header = block.slice(0, 12000);
      if (/SECURITY\s+DEFINER/i.test(header) && !/SET\s+search_path\s*(?:=|TO)\s*/i.test(header)) {
        failures.push(`${file}: SECURITY DEFINER function without explicit SET search_path`);
      }
    }
  }

  const dangerousGrants = [
    /GRANT\s+EXECUTE\s+ON\s+FUNCTION[^;]*\bTO\s+anon\b/i,
    /GRANT\s+EXECUTE\s+ON\s+FUNCTION[^;]*\bTO\s+public\b/i,
  ];

  for (const pattern of dangerousGrants) {
    if (pattern.test(sql)) {
      failures.push(`${file}: privileged function EXECUTE granted to anon/public`);
    }
  }
}

if (failures.length > 0) {
  console.error("\nSecurity regression failures:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Supabase security guardrails: PASS");
