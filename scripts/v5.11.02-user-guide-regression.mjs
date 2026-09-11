import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const page=path.join(root,'src/app/(protected)/aide/page.tsx');
const checks=[
 [fs.existsSync(page),'page aide'],
 [fs.existsSync(path.join(root,'README_V5.11.02-USER-GUIDE.md')),'documentation'],
 [fs.readFileSync(page,'utf8').includes('id="bien-utiliser"'),'Bien utiliser'],
 [fs.readFileSync(page,'utf8').includes('id="particulier"'),'Particulier'],
 [fs.readFileSync(page,'utf8').includes('id="entreprise"'),'Entreprise'],
 [fs.readFileSync(page,'utf8').includes('id="lia"'),'LIA'],
 [fs.readFileSync(page,'utf8').includes('id="securite"'),'Sécurité'],
 [fs.readFileSync(page,'utf8').includes('id="lexique"'),'Lexique'],
 [fs.readFileSync(path.join(root,'src/components/desktop-sidebar.tsx'),'utf8').includes('href="/aide"'),'navigation desktop'],
 [fs.readFileSync(path.join(root,'src/components/header.tsx'),'utf8').includes('href="/aide"'),'navigation mobile'],
];
let fail=0; for(const [ok,label] of checks){console.log(`${ok?'PASS':'FAIL'} ${label}`);if(!ok)fail++;} if(fail)process.exit(1); console.log(`\nUser guide regression: ${checks.length}/${checks.length} PASS`);
