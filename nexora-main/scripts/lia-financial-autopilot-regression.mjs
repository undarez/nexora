import { readFileSync } from "node:fs";
const files=["src/lib/lia/financial-autopilot/engine.ts","src/lib/lia/financial-autopilot/index.ts","src/app/api/lia/autopilot/route.ts","src/app/api/lia/runtime/cron/route.ts"];
for(const f of files){const s=readFileSync(f,"utf8");if(!s.length) throw new Error(`empty autopilot file: ${f}`);}
const engine=readFileSync(files[0],"utf8");
for(const token of ["inferEnvelope","predictRecurringExpenses","findOpportunities","observeBudget"]){if(!engine.includes(`function ${token}`)) throw new Error(`missing ${token}`)}
console.log("✓ financial autopilot contract");
