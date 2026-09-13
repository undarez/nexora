import fs from "node:fs"; import path from "node:path";
const root=process.cwd();
const must=["src/lib/lia/prospective-outlook.ts","src/lib/lia/mail-financial-signals.ts","src/lib/lia/prospective-reasoning.ts","src/lib/integrations/mail.ts"];
let pass=0;
for(const f of must){if(fs.existsSync(path.join(root,f))){console.log("PASS "+f);pass++;}else console.log("FAIL "+f)}
const out=fs.readFileSync(path.join(root,"src/lib/lia/prospective-outlook.ts"),"utf8");
for(const x of ["Base","Revenus -10 %","Dépenses +10 %","projectedBalance"]){if(out.includes(x)){console.log("PASS outlook "+x);pass++;}else console.log("FAIL outlook "+x)}
const mail=fs.readFileSync(path.join(root,"src/lib/lia/mail-financial-signals.ts"),"utf8");
for(const x of ["invoice","payment_due","banking","subscription","bodyAccess:false","attachmentsAccess:false"]){if(mail.includes(x)){console.log("PASS mail signal "+x);pass++;}else console.log("FAIL mail signal "+x)}
console.log(`V5.08.37 checks: ${pass}/14 PASS`); if(pass!==14)process.exit(1);
