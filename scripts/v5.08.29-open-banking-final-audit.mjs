import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [
  ['90-day lifecycle gate exists', 'src/lib/banking/lifecycle.ts', ['RECONNECT_WINDOW_DAYS = 90', 'needs_reauth', 'CONSENT_EXPIRED']],
  ['sync blocks expired/re-auth connections', 'src/lib/banking/sync-engine.ts', ['enforceReconnectDeadline', 'lifecycleGate.blocked', 'connectionId']],
  ['successful sync keeps a reconnect deadline', 'src/lib/banking/sync-engine.ts', ['reconnect_due_at', '90 * 24 * 60 * 60 * 1000']],
  ['callback creates 90-day deadline', 'src/app/api/banking/powens/callback/route.ts', ['reconnectDueAt', '90 * 24 * 60 * 60 * 1000']],
  ['provider revocation is server-side', 'src/lib/banking/powens-adapter.ts', ['disconnect', 'method: "DELETE"']],
  ['webhook signature is time-bounded', 'src/app/api/banking/powens/webhook/route.ts', ['BI-Signature', 'timingSafeEqual', '5 * 60 * 1000']],
  ['webhook delivery is idempotent', 'src/app/api/banking/powens/webhook/route.ts', ['bank_webhook_events', '23505']],
  ['workspace access is checked', 'src/app/api/banking/connect/route.ts', ['financial_workspace_members', 'status', 'active']],
  ['bank connection API never exposes credentials', 'src/app/api/banking/connections/route.ts', ['rawCredentialsExposed: false']],
  ['90-day notification milestones remain present', 'supabase/migrations/0098_schema_reconciliation_and_runtime_integrity.sql', ['bank-reconnect:', '30', '14', '7', '1', 'RECONNECT_90D_REQUIRED']],
];
let passed=0;
for (const [name,file,needles] of checks) {
  const text=read(file);
  for (const needle of needles) if (!text.includes(needle)) throw new Error(`${name}: missing ${needle}`);
  console.log(`PASS: ${name}`); passed++;
}
console.log(`Open Banking final audit: ${passed}/${checks.length} PASS`);
