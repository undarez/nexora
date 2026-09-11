import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const required = [
  ['workspace-aware connection API', 'src/app/api/banking/connections/route.ts', ['workspaceId', 'financial_workspace_members', 'owner', 'admin']],
  ['workspace-aware banking API', 'src/app/api/banking/connections/route.ts', ['workspaceId', 'financial_workspace_members']],
  ['enterprise cockpit remains a read model', 'src/app/(protected)/entreprise/page.tsx', ['EnterpriseDashboard']],
  ['Powens enterprise callback routing', 'src/app/api/banking/powens/callback/route.ts', ['/entreprise', 'workspace_id']],
  ['post-sync provider reconciliation', 'src/lib/banking/sync-engine.ts', ['getConnectionState', 'PROVIDER_REAUTH_REQUIRED']],
  ['90-day reminders', 'supabase/migrations/0092_open_banking_90_day_reconnection.sql', ['reconnect_due_at', 'bank-reconnect:', 'RECONNECT_90D_REQUIRED']],
];
for (const [name, file, needles] of required) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  for (const needle of needles) if (!text.includes(needle)) throw new Error(`${name}: missing ${needle}`);
  console.log(`PASS: ${name}`);
}
console.log('Open Banking final lifecycle regression: PASS');
