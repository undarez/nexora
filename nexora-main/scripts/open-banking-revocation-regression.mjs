import fs from 'node:fs';
const files = {
  types: fs.readFileSync('src/lib/banking/types.ts','utf8'),
  powens: fs.readFileSync('src/lib/banking/powens-adapter.ts','utf8'),
  accounts: fs.readFileSync('src/app/api/banking/accounts/route.ts','utf8'),
  connections: fs.readFileSync('src/app/api/banking/connections/route.ts','utf8'),
  webhook: fs.readFileSync('src/app/api/banking/powens/webhook/route.ts','utf8'),
  migration: fs.readFileSync('supabase/migrations/0090_open_banking_account_revocation.sql','utf8'),
};
const checks = [
  ['provider supports account deactivation', files.types.includes('deactivateAccounts') && files.powens.includes('deactivateAccounts')],
  ['account revoke endpoint is DELETE and provider-backed', files.accounts.includes('export async function DELETE') && files.accounts.includes('adapter.deactivateAccounts')],
  ['connection revoke marks local accounts revoked', files.connections.includes('status: "revoked"') && files.connections.includes('bank_accounts')],
  ['CONNECTION_DELETED webhook is handled', files.webhook.includes('CONNECTION_DELETED') && files.webhook.includes('status: "revoked"')],
  ['ACCOUNT_DISABLED/ENABLED webhook is handled', files.webhook.includes('ACCOUNT_DISABLED') && files.webhook.includes('ACCOUNT_ENABLED')],
  ['local account access state is persisted', files.migration.includes("status text not null default 'active'") && files.migration.includes('access_revoked_at')],
];
for (const [label, ok] of checks) console.log(`${ok ? 'OK' : 'FAIL'} ${label}`);
if (checks.some(([,ok])=>!ok)) process.exit(1);
