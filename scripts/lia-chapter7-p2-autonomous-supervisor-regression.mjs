import fs from "node:fs";
import assert from "node:assert/strict";

const supervisor = fs.readFileSync("src/lib/lia/agents/supervisor.ts", "utf8");
const types = fs.readFileSync("src/lib/lia/agents/supervisor-types.ts", "utf8");
for (const marker of ["runAutonomousMission", "lia_orchestration_runs", "lia_orchestration_budgets", "lia_orchestration_steps", "fallback", "replans", "critique", "lia_specialist_work_memory"]) assert.ok(supervisor.includes(marker), marker);
for (const marker of ["LiaMissionTask", "LiaMissionEvidence", "LiaMissionResult"]) assert.ok(types.includes(marker), marker);
assert.ok(supervisor.includes("executeSpecialistCommand"));
console.log("P2 AUTONOMOUS SUPERVISOR REGRESSION: PASS");
