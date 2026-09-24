import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const executor = fs.readFileSync(path.join(root, "src/lib/lia/agents/executor.ts"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/0120_lia_specialist_agents.sql"), "utf8");
const gitignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

assert.match(executor, /assertSpecialistCanRun\(plan(?:,|\))/);
assert.match(executor, /permissions\?: readonly LiaPermission\[\]/);
assert.doesNotMatch(executor, /permissions\?: readonly any\[\]/);
assert.match(executor, /executeExecutableLiaSkill/);
assert.match(executor, /verification: \{ required: true, passed: true/);
assert.match(executor, /lia_consume_specialist_budget/);
assert.match(migration, /create or replace function public\.lia_consume_specialist_budget/);
assert.match(migration, /max_tool_calls integer/);
assert.match(migration, /max_research_requests integer/);
assert.match(migration, /max_memory_writes integer/);
assert.doesNotMatch(gitignore, /Set-Content/);

const missing = [];
for (const [name, command] of Object.entries(pkg.scripts)) {
  let script = null;
  if (command.startsWith("node ")) script = command.slice(5);
  if (script?.startsWith("--experimental-strip-types ")) script = script.slice("--experimental-strip-types ".length);
  if (script?.startsWith("scripts/") && !fs.existsSync(path.join(root, script))) missing.push(name + ":" + script);
}
assert.deepEqual(missing, []);

console.log("LIA Chapter 7 P0 hardening regression: PASS");
