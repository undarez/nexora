import fs from "node:fs";
const file = "src/lib/lia/agent-harness.ts";
if (!fs.existsSync(file)) throw new Error("agent-harness.ts missing");
const source = fs.readFileSync(file, "utf8");
for (const invariant of ["maxSteps", "maxToolCalls", "maxWallTimeMs", "Répétition", "status"]) {
  if (!source.includes(invariant)) throw new Error(`Harness invariant missing: ${invariant}`);
}
console.log("LIA agent harness regression: PASS");
