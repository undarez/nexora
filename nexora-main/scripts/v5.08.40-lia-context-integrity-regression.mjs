import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const files=[
  "src/lib/lia/application-context.ts",
  "src/lib/lia/multi-source-context.ts",
  "src/app/api/lia/chat/route.ts",
];
let pass=0;
for(const f of files){if(fs.existsSync(path.join(root,f))){console.log("PASS "+f);pass++;}else console.log("FAIL "+f)}
const app=fs.readFileSync(path.join(root,"src/lib/lia/application-context.ts"),"utf8");
for(const x of [
  "const [model, notificationsResult, mailConnectionsResult]",
  "mailConnectionsResult.data",
  "buildLiaMultiSourceContext({",
  "financeAvailable: model.financial.accounts.length > 0",
  "mailProviders,",
  "multi_source: buildLiaMultiSourceContext({",
  "authority_granted: false",
]){if(app.includes(x)){console.log("PASS context integrity "+x);pass++;}else console.log("FAIL context integrity "+x)}
console.log(`V5.08.40 checks: ${pass}/10 PASS`);
if(pass!==10) process.exit(1);
