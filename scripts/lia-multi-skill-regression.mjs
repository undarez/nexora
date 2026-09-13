import { readFileSync } from "node:fs";
const p = "src/lib/lia/financial-memory/pipeline.ts";
const s = readFileSync(p, "utf8");
if (!s.includes("skills: SkillHit[]")) throw new Error("LiaBrainContext multi-skill missing");
if (!s.includes("querySkills") || !s.includes("intelligenceSkills")) throw new Error("multi-skill retrieval missing");
if (!s.includes("selected_skills")) throw new Error("multi-skill compact context missing");
console.log("LIA multi-skill regression: PASS");
