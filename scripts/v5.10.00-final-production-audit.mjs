import fs from 'node:fs';
const checks=[
 ['package version >= production hardening','package.json'],
 ['security regression','scripts/v5.09.02-production-security-regression.mjs'],
 ['production hardening regression','scripts/v5.09.01-production-hardening-regression.mjs'],
 ['production audit','scripts/v5.09.03-production-audit.mjs'],
 ['Open Banking lifecycle','src/lib/banking/lifecycle.ts'],
 ['LIA action boundary','src/lib/lia/actions/boundary.ts'],
 ['LIA data governance','src/lib/lia/data-governance.ts'],
 ['LIA self evaluation','src/lib/lia/self-evaluation.ts'],
 ['LIA learning promotion','src/lib/lia/learning-promotion.ts'],
 ['LIA activation governance','src/lib/lia/skill-activation.ts'],
];
let pass=0; for(const [label,file] of checks){const ok=fs.existsSync(file); console.log(`${ok?'PASS':'FAIL'} ${label}`); if(ok)pass++;}
console.log(`\n${pass}/${checks.length} final production architecture checks PASS`); if(pass!==checks.length)process.exit(1);
