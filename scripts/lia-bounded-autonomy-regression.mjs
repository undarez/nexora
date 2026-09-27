import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const engine = readFileSync(join(root, "src/lib/lia/autonomy/bounded-engine.ts"), "utf8");
const runner = readFileSync(join(root, "src/lib/lia/autonomous-goal-runner.ts"), "utf8");
const executor = readFileSync(join(root, "src/lib/agent-runtime/executor.ts"), "utf8");

const checks = [
  ["bounded engine exists", engine.includes("function autonomousToolSet")],
  ["L3 enables low-risk recommendation execution", engine.includes("level >= 3")],
  ["human approval remains a hard block", engine.includes("human_approval_required")],
  ["runner reads configured autonomy", runner.includes('rpc("get_lia_autonomy"')],
  ["runner uses bounded capability mapping", runner.includes("autonomousToolSet(AGENT_TOOLS, autonomyData)"),
  ["runner records autonomy profile", runner.includes("describeAutonomy(autonomy.level)")],
  ["server Policy Engine remains authoritative", executor.includes('rpc("authorize_lia_tool"')],
  ["sensitive writes remain blocked", executor.includes('definition.risk === "write-sensitive"')],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
console.log("Bounded autonomy regression: PASS");
