import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const files=["src/lib/lia/multi-source-context.ts","src/lib/lia/application-context.ts","src/app/api/lia/chat/route.ts","src/lib/lia/mail-financial-signals.ts","src/lib/integrations/mail.ts"];
let pass=0;
for(const f of files){if(fs.existsSync(path.join(root,f))){console.log("PASS "+f);pass++;}else console.log("FAIL "+f)}
const ms=fs.readFileSync(path.join(root,"src/lib/lia/multi-source-context.ts"),"utf8");
for(const x of ["authoritative","signal","bodies_included: false","attachments_included: false","Prioriser les faits financiers observés"]){if(ms.includes(x)){console.log("PASS multi-source "+x);pass++;}else console.log("FAIL multi-source "+x)}
const chat=fs.readFileSync(path.join(root,"src/app/api/lia/chat/route.ts"),"utf8");
for(const x of ["buildMultiSourceContext","multi_source: multiSourceContext","mail_integrations"]){if(chat.includes(x)){console.log("PASS chat integration "+x);pass++;}else console.log("FAIL chat integration "+x)}
console.log(`V5.08.39 checks: ${pass}/13 PASS`);
if(pass!==13) process.exit(1);
