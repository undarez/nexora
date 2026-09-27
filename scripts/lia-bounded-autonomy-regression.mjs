import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const engine = readFileSync(join(root, "src/lib/lia/autonomy/bounded-engine.ts"), "utf8");
const runner = readFileSync(join(root, "src/lib/lia/autonomous-goal-runner.ts"), "utf8");
const executor = readFileSync(join(root, "src/lib/agent-runtime/executor.ts"), "utf8");
const learning = readFileSync(join(root, "src/lib/lia/learning/autonomous.ts"), "utf8");
const identity = readFileSync(join(root, "src/lib/security/agent-identity.ts"), "utf8");
const releaseMigration = readFileSync(join(root, "supabase/migrations/0131_lia_learning_policy_alignment.sql"), "utf8");
const autonomyServiceMigration = readFileSync(join(root, "supabase/migrations/0132_lia_autonomy_service_read.sql"), "utf8");
const canaryRollbackMigration = readFileSync(join(root, "supabase/migrations/0133_lia_skill_canary_auto_rollback.sql"), "utf8");
const releaseController = readFileSync(join(root, "src/lib/lia/skill-release-controller.ts"), "utf8");

const checks = [
  ["bounded engine exists", engine.includes("function autonomousToolSet")],
  ["L3 enables low-risk recommendation execution", engine.includes("level >= 3")],
  ["L4 enables bounded chaining", engine.includes("level >= 4 ? bounded : 1")],
  ["L5 has a complex-goal strategy", engine.includes('return "complex_goal"')],
  ["L6 has an adaptive-replan strategy", engine.includes('return "adaptive_replan"')],
  ["L7 is required for validated learning", runner.includes("autonomy.level >= 7")],
  ["learning tools are blocked below L7", engine.includes("validatedLearningTool && level >= 7") && engine.includes("validated_learning_requires_L7")],
  ["autonomous learning cycle fail-closes below L7", learning.includes("validated_learning_requires_L7") && learning.includes('rpc("get_lia_autonomy"')],
  ["L8 has an extended-goal strategy", engine.includes('return "extended_goal"')],
  ["strategy reaches reasoning engine", runner.includes("strategy: autonomyProfile.strategy") && readFileSync(join(root, "src/lib/lia/reasoning-engine-v2.ts"), "utf8").includes("strategy?: string")],
  ["policy minimums are consulted", engine.includes("getAgentPolicy(tool.name)")],
  ["learning policy is L7 in server identity", identity.includes("learn_use_case: { minAutonomy: 7") && identity.includes("learn_skill: { minAutonomy: 7")],
  ["database learning policy is aligned to L7", releaseMigration.includes("set min_autonomy_level = 7") && releaseMigration.includes("learn_use_case") && releaseMigration.includes("learn_skill")],
  ["skill release requires promoted exact version", releaseMigration.includes("b.status='promoted'") && releaseMigration.includes("b.skill_version_id=c.candidate_version_id")],
  ["skill release rechecks memory gate", releaseMigration.includes("memory_gate_failed") && releaseMigration.includes("v.memory_gate")],
  ["service-side autonomy reads are explicitly scoped", autonomyServiceMigration.includes("auth.role() <> \'service_role\'") && autonomyServiceMigration.includes("grant execute on function public.get_lia_autonomy(uuid) to authenticated,service_role")],
  ["human approval remains a hard block", engine.includes("human_approval_required")],
  ["runner reads configured autonomy", runner.includes('rpc("get_lia_autonomy"')],
  ["runner uses bounded capability mapping", runner.includes("autonomousToolSet(AGENT_TOOLS, autonomyData)")],
  ["runner records autonomy profile", runner.includes("describeAutonomy(autonomy.level)")],
  ["server Policy Engine remains authoritative", executor.includes('rpc("authorize_lia_tool"')],
  ["canary auto-rollback is service-role only", canaryRollbackMigration.includes("auth.role() <> 'service_role'") && canaryRollbackMigration.includes("grant execute on function public.lia_skill_canary_auto_rollback(uuid,text) to service_role")],
  ["canary rollback requires observed evidence", canaryRollbackMigration.includes("canary_observations") && canaryRollbackMigration.includes("rollback_threshold_not_reached")],
  ["canary health runtime invokes rollback RPC", releaseController.includes('rpc("lia_skill_canary_auto_rollback"')],
  ["sensitive writes remain blocked", executor.includes('definition.risk === "write-sensitive"')],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
console.log("Bounded autonomy regression: PASS");
