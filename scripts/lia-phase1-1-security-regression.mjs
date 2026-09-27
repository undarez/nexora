import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const releaseRoute = read("src/app/api/lia/skills/release/route.ts");
const hardening = read("supabase/migrations/20260927110000_lia_phase1_1_release_control_hardening.sql");
const canaryRollback = read("supabase/migrations/0133_lia_skill_canary_auto_rollback.sql");
const dashboard = read("src/components/dashboard.tsx");
const rpcScopeHardening = read("supabase/migrations/20260927130000_lia_phase1_1_rpc_owner_scope_hardening.sql");

const checks = [
  ["release route requires admin", releaseRoute.includes("requireAdmin(supabase)")],
  ["release route uses privileged control-plane RPC", releaseRoute.includes('admin.rpc("lia_skill_release_transition_admin"')],
  ["release route passes authenticated admin actor", releaseRoute.includes("p_actor: adminUser.id")],
  ["legacy authenticated release RPC is revoked", hardening.includes("revoke execute on function public.lia_skill_release_transition(uuid, text, text)\n  from public, anon, authenticated")],
  ["admin release wrapper is service-role only", hardening.includes("grant execute on function public.lia_skill_release_transition_admin(uuid, text, text, uuid)\n  to service_role")],
  ["admin release wrapper requires an actor", hardening.includes("control_plane_actor_required")],
  ["activation ledger permits system rollback", hardening.includes("alter column activated_by drop not null")],
  ["automatic rollback currently records a system event", canaryRollback.includes("'rolled_back','system',null")],
  ["dashboard refreshes banking connections itself", dashboard.includes('fetch("/api/banking/connections"')],
  ["dashboard synchronizes connections through POST", dashboard.includes('fetch("/api/banking/sync"')],
  ["dashboard exposes manual refresh", dashboard.includes("Actualiser les comptes et liquidités")],
  ["skill search is caller-scoped or service-role only", rpcScopeHardening.includes("auth.role() = 'service_role'") && rpcScopeHardening.includes("p_user_id = auth.uid()")],
  ["use-case search is caller-scoped or service-role only", rpcScopeHardening.includes("lia_search_use_cases") && rpcScopeHardening.includes("p_user_id = auth.uid()")],
  ["cognitive session touch is caller-scoped", rpcScopeHardening.includes("lia_touch_cognitive_session") && rpcScopeHardening.includes("p_user_id <> auth.uid()")],
  ["owner-scoped RPC grants remain explicit", rpcScopeHardening.includes("grant execute on function public.lia_search_skills") && rpcScopeHardening.includes("grant execute on function public.lia_search_use_cases")],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (ok) console.log(`PASS  ${name}`);
  else {
    failed += 1;
    console.error(`FAIL  ${name}`);
  }
}

if (failed) {
  console.error(`\\nPhase 1.1 regression failed: ${failed} check(s).`);
  process.exit(1);
}

console.log("\\nPhase 1.1 security regression: PASS");
