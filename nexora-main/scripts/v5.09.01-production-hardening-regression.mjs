import fs from 'node:fs';

const checks = [
  ['runtime migration', 'supabase/migrations/0112_lia_production_runtime_metrics.sql'],
  ['runtime admin route', 'src/app/api/admin/lia/production-runtime/route.ts'],
  ['runtime metrics', 'src/lib/lia/production-telemetry.ts'],
  ['provider usage', 'src/lib/lia/provider/index.ts'],
  ['admin runtime UI', 'src/app/(protected)/admin/ai/ui.tsx'],
];
let pass = 0;
for (const [label, file] of checks) {
  if (fs.existsSync(file)) { console.log(`PASS ${label}`); pass++; } else console.log(`FAIL ${label}`);
}
const migration = fs.readFileSync(checks[0][1], 'utf8');
for (const token of ['latency_ms','generated_tokens','estimated_cost_cents']) {
  if (migration.includes(token)) { console.log(`PASS migration:${token}`); pass++; } else console.log(`FAIL migration:${token}`);
}
const route = fs.readFileSync(checks[1][1], 'utf8');
for (const token of ['isAdmin','estimated_cost_cents','p95Ms']) {
  if (route.includes(token)) { console.log(`PASS route:${token}`); pass++; } else console.log(`FAIL route:${token}`);
}
console.log(`
${pass}/11 checks PASS`);
if (pass !== 11) process.exit(1);
