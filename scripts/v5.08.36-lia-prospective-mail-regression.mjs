import fs from 'node:fs'; import path from 'node:path';
const root=process.cwd(); const must=[
 'src/lib/lia/prospective-reasoning.ts','src/lib/integrations/mail.ts','src/app/api/lia/mail/context/route.ts','src/app/api/lia/mail/connect/route.ts','src/app/api/lia/gmail/route.ts','src/app/api/lia/outlook/route.ts','supabase/migrations/0101_lia_mail_connections.sql'
];
let pass=0; for(const f of must){if(fs.existsSync(path.join(root,f))){console.log(`PASS ${f}`);pass++;}else console.log(`FAIL ${f}`)}
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')); console.log(pkg.scripts['lia:prospective-mail']?'PASS package script':'FAIL package script'); if(pkg.scripts['lia:prospective-mail'])pass++;
const mail=fs.readFileSync(path.join(root,'src/lib/integrations/mail.ts'),'utf8'); for(const x of ['gmail','outlook','Mail.Read','gmail.readonly']){if(mail.includes(x)){console.log(`PASS mail contract ${x}`);pass++}else console.log(`FAIL mail contract ${x}`)}
console.log(`V5.08.36 checks: ${pass}/12 PASS`); if(pass!==12)process.exit(1);
