import fs from 'node:fs';
const required=[
 'scripts/v5.10.01-16-production-suite-regression.mjs',
 'docs/production/release-candidate.md',
 'tests/production/lia-behavioral-scenarios.json',
 'src/app/global-error.tsx',
 'src/app/(protected)/error.tsx',
 'src/lib/production/resilience.ts',
 'supabase/migrations/0112_lia_production_runtime_metrics.sql',
];
let pass=0; for(const f of required){const ok=fs.existsSync(f); console.log(`${ok?'PASS':'FAIL'} ${f}`); if(ok)pass++;}
const pkg=JSON.parse(fs.readFileSync('package.json','utf8')); const ok=/^0\.1\.(12[3-9]|1[3-9]\d|[2-9]\d{2})$/.test(pkg.version); console.log(`${ok?'PASS':'FAIL'} release candidate package ${pkg.version}`); if(ok)pass++;
console.log(`\n${pass}/${required.length+1} release candidate checks PASS`); if(pass!==required.length+1)process.exit(1);
