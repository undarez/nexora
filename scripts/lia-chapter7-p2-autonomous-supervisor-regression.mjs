import fs from "node:fs";
import assert from "node:assert/strict";

const supervisor = fs.readFileSync("src/lib/lia/agents/supervisor.ts", "utf8");
const types = fs.readFileSync("src/lib/lia/agents/supervisor-types.ts", "utf8");

for (const marker of [
  "runLiaMission",
  "runAutonomousMission",
  "executeSpecialistCommand",
  "evidence",
  "replans",
  "critique",
  "memoryWritten",
]) assert.ok(supervisor.includes(marker), marker);

for (const marker of ["LiaMissionTask", "LiaMissionEvidence", "LiaMissionResult", "LiaMissionOptions"]) {
  assert.ok(types.includes(marker), marker);
}

console.log("P2 AUTONOMOUS SUPERVISOR REGRESSION: PASS");
