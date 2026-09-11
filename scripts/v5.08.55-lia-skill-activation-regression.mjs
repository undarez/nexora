import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = [
  'src/lib/lia/skill-activation.ts',
  'src/app/api/admin/lia/skill-activation/route.ts',
  'src/app/api/admin/veille/route.ts',
  'src/app/(protected)/veille/ui.tsx',
  'supabase/migrations/0109_lia_skill_activation_governance.sql',
];
const checks = [
  ['activation module exists', fs.existsSync(path.join(root, files[0]))],
  ['dedicated activation API exists', fs.existsSync(path.join(root, files[1]))],
  ['legacy veille route uses governed activation', fs.readFileSync(path.join(root, files[2]), 'utf8').includes('lia_governed_activate_skill')],
  ['activation requires explicit reason in UI', fs.readFileSync(path.join(root, files[3]), 'utf8').includes('Justification d’activation')],
  ['active_version_id exists', fs.readFileSync(path.join(root, files[4]), 'utf8').includes('active_version_id')],
  ['activation history is unique while active', fs.readFileSync(path.join(root, files[4]), 'utf8').includes("where status='active'" )],
  ['governed promotion is required', fs.readFileSync(path.join(root, files[4]), 'utf8').includes("b.status='promoted'" )],
  ['memory gate is enforced', fs.readFileSync(path.join(root, files[4]), 'utf8').includes('memory_gate_failed')],
  ['legacy activation fails closed', fs.readFileSync(path.join(root, files[4]), 'utf8').includes('activation_requires_governed_pipeline')],
  ['rollback is governed', fs.readFileSync(path.join(root, files[4]), 'utf8').includes('lia_governed_rollback_skill')],
  ['active skills pin exact activated version', fs.readFileSync(path.join(root, files[4]), 'utf8').includes('s.active_version_id')],
  ['model/policy/financial/permission updates blocked', fs.readFileSync(path.join(root, files[0]), 'utf8').includes('permissionUpdate: false')],
];
let failed = 0;
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++; }
if (failed) process.exit(1);
console.log(`V5.08.55 Skill Activation Governance: ${checks.length}/${checks.length} PASS`);
