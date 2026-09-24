import fs from "node:fs";
import assert from "node:assert/strict";

const supervisor = fs.readFileSync("src/lib/lia/agents/supervisor.ts", "utf8");
const types = fs.readFileSync("src/lib/lia/agents/supervisor-types.ts", "utf8");

for (const marker of [
  "runLiaMission",
  "runAutonomousMission",
  "buildLiaCommandPlan",
  "executeSpecialistCommand",
  "splitMissionObjective",
  "critiqueMission",
  "replans",
  "maxReplans",
  "waiting_confirmation",
  "lia_orchestration_start_run",
  "lia_orchestration_upsert_step",
  "lia_orchestration_request_replan",
  "lia_orchestration_write_work_memory",
  "rewireDependencies",
]) assert.ok(supervisor.includes(marker), marker);

for (const marker of ["LiaMissionTask", "LiaMissionEvidence", "LiaMissionResult", "LiaMissionOptions"]) {
  assert.ok(types.includes(marker), marker);
}

assert.ok(!supervisor.includes('agentId: "finance"'));
assert.ok(!supervisor.includes('skillId: "finance-analytics"'));
assert.ok(supervisor.includes("FALLBACK_INTENTS"));
assert.ok(supervisor.includes("orchestration_budget_exhausted"));
assert.ok(supervisor.includes("orchestration_persistence_unavailable"));

const migration = fs.readFileSync(
  "supabase/migrations/20260924090000_lia_chapter7_p3_1_supervisor_persistence.sql",
  "utf8",
);
for (const marker of [
  "lia_orchestration_start_run",
  "lia_orchestration_upsert_step",
  "lia_orchestration_update_run",
  "lia_orchestration_request_replan",
  "lia_orchestration_write_work_memory",
  "set search_path = public, pg_temp",
  "revoke all on function",
]) assert.ok(migration.includes(marker), marker);

console.log("P3.1 PERSISTENT SUPERVISOR REGRESSION: PASS");
