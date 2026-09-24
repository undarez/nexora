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
]) assert.ok(supervisor.includes(marker), marker);

for (const marker of ["LiaMissionTask", "LiaMissionEvidence", "LiaMissionResult", "LiaMissionOptions"]) {
  assert.ok(types.includes(marker), marker);
}

assert.ok(!supervisor.includes('agentId: "finance"'));
assert.ok(!supervisor.includes('skillId: "finance-analytics"'));

console.log("P3 SUPERVISOR ROUTING REGRESSION: PASS");
