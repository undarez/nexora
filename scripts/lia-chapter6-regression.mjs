import fs from "node:fs";
const files=[
 "supabase/migrations/0128_lia_skill_lab.sql",
 "src/lib/lia/learning/skill-lab.ts",
 "src/lib/lia/replay-harness.ts",
 "src/lib/lia/learning/autonomous.ts"
];
const missing=files.filter(f=>!fs.existsSync(f));
if(missing.length) throw new Error("Missing Chapter 6 files: "+missing.join(", "));
const lab=fs.readFileSync(files[1],"utf8");
for(const marker of ["challengeSkill","challengeToScenario","no_challenges_generated","proposeVersion","buildReplayReport","candidate.runs","activationAllowed:false","lia_create_skill_candidate"]) if(!lab.includes(marker)) throw new Error("Missing Chapter 6 gate: "+marker);
console.log("Chapter 6 Skill Laboratory: PASS");
