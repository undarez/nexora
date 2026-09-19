import fs from "node:fs";
const files=[
 "supabase/migrations/0126_lia_runtime_recovery.sql",
 "src/lib/lia/autonomous-goal-runner.ts",
 "src/lib/lia/learning/skill-evaluator.ts",
 "src/lib/lia/learning/autonomous.ts"
];
const missing=files.filter(f=>!fs.existsSync(f));
if(missing.length) throw new Error("Missing Chapter 5 files: "+missing.join(", "));
const sql=fs.readFileSync(files[0],"utf8");
for(const marker of ["lia_recover_stale_runtime_jobs","lia_recover_agentic_state"]) if(!sql.includes(marker)) throw new Error("Missing recovery gate: "+marker);
const runner=fs.readFileSync(files[1],"utf8");
for(const marker of ["buildLiaBrainContext","verifyReadOnlyObservation","runOppositionLearning","acceptLearningRecord","evaluateLiaSkills"]) if(!runner.includes(marker)) throw new Error("Missing Chapter 5 integration: "+marker);
console.log("Chapter 5 autonomous mission: PASS");
