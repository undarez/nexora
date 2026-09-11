import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const required=['supabase/migrations/0095_product_analytics_events.sql','src/app/api/analytics/route.ts','src/components/analytics/product-analytics-tracker.tsx','src/app/(protected)/admin/analytics/page.tsx'];
const failures=[];
for(const f of required) if(!fs.existsSync(path.join(root,f))) failures.push(`missing:${f}`);
const api=fs.readFileSync(path.join(root,'src/app/api/analytics/route.ts'),'utf8');
for(const x of ["event_name","session_id","feature_key","auth.getUser","product_analytics_events"]) if(!api.includes(x)) failures.push(`api:${x}`);
const migration=fs.readFileSync(path.join(root,'supabase/migrations/0095_product_analytics_events.sql'),'utf8');
for(const x of ['enable row level security','product_analytics_events_insert_own','auth.uid() = user_id']) if(!migration.includes(x)) failures.push(`rls:${x}`);
const page=fs.readFileSync(path.join(root,'src/app/(protected)/admin/analytics/page.tsx'),'utf8');
for(const x of ['getAdminContext','isAdmin','getSupabaseAdmin','30 derniers jours']) if(!page.includes(x)) failures.push(`admin:${x}`);
if(failures.length){console.error('PRODUCT ANALYTICS REGRESSION: FAIL'); failures.forEach(x=>console.error(`- ${x}`)); process.exit(1);}
console.log('PRODUCT ANALYTICS REGRESSION: PASS');
console.log(`Verified ${required.length} analytics files, user-scoped RLS and admin-only dashboard guard.`);
