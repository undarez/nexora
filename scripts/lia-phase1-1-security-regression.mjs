import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const releaseRoute = read("src/app/api/lia/skills/release/route.ts");
const hardening = read("supabase/migrations/20260927110000_lia_phase1_1_release_control_hardening.sql");
const canaryRollback = read("supabase/migrations/0133_lia_skill_canary_auto_rollback.sql");
const dashboard = read("src/components/dashboard.tsx");

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
