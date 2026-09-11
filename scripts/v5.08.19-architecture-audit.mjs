import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (p) => readFileSync(p, 'utf8');

assert(existsSync('src/lib/finance/unified-financial-context.ts'));
assert(existsSync('src/lib/enterprise/dashboard-context.ts'));
assert(existsSync('src/lib/banking/types.ts'));
assert(existsSync('src/lib/banking/powens-adapter.ts'));
assert(existsSync('src/lib/banking/sync-engine.ts'));

const sidebar = read('src/components/desktop-sidebar.tsx');
assert.match(sidebar, /\["\/pilotage", "Pilotage"/);
assert.doesNotMatch(sidebar, /\["\/autopilot"/);
assert.doesNotMatch(sidebar, /\["\/habitudes"/);

const dashboard = read('src/app/(protected)/dashboard/page.tsx');
const forecast = read('src/app/(protected)/previsions/page.tsx');
const pilotage = read('src/app/(protected)/pilotage/page.tsx');
assert.match(dashboard, /Dashboard/);
assert.match(forecast, /unified-financial-context|buildUnifiedFinancialContext/);
assert.match(pilotage, /unified-financial-context|buildUnifiedFinancialContext/);

const connect = read('src/app/api/banking/connect/route.ts');
const connections = read('src/app/api/banking/connections/route.ts');
const sync = read('src/lib/banking/sync-engine.ts');
const callback = read('src/app/api/banking/powens/callback/route.ts');
assert.match(connect, /workspaceId/);
assert.match(connections, /workspaceId/);
assert.match(connections, /financial_workspace_members/);
assert.match(read('src/lib/banking/lifecycle.ts'), /RECONNECT_90D_REQUIRED/);
assert.match(sync, /getConnectionState/);
assert.match(callback, /reconnect_due_at/);

const enterprise = read('src/app/(protected)/entreprise/page.tsx');
const enterpriseContext = read('src/lib/enterprise/dashboard-context.ts');
assert.match(enterprise, /EnterpriseDashboard/);
assert.match(enterpriseContext, /buildUnifiedFinancialContext/);
assert.match(enterpriseContext, /history/);
assert.doesNotMatch(enterprise, /EnterpriseBankConnections|EnterpriseObligations|buildEnterpriseFinancialContext/);

const notifications = read('src/app/api/notifications/refresh/route.ts');
const bell = read('src/components/notifications/notification-bell.tsx');
assert.match(notifications, /refresh_financial_notifications/);
assert.match(bell, /refreshNotifications\(\{ force: true \}\)/);

const migrations = read('supabase/migrations/0092_open_banking_90_day_reconnection.sql');
assert.match(migrations, /reconnect_due_at/);
assert.match(migrations, /J-30|30 days|30/);

console.log('V5.08.19 architecture audit: PASS');
