import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root,p), "utf8");
const checks = [
  ["landing N/orbit removed", !read("src/app/(landing)/page.tsx").includes("landing-hero-logo-orbit")],
  ["LIA greeting preamble removed", !read("src/lib/lia/deterministic-engine.ts").includes("Analyse LIA — moteur cognitif intégré")],
  ["Hermes route removed", !fs.existsSync(path.join(root,"src/app/api/hermes/health/route.ts"))],
  ["Hermes client removed", !fs.existsSync(path.join(root,"src/lib/hermes/client.ts"))],
  ["notification popover viewport anchored", read("src/components/notifications/notification-bell.tsx").includes('className="fixed z-[100]')],
  ["runtime progress UI present", read("src/app/(protected)/runtime/ui.tsx").includes("Progression du runtime")],
  ["veille admin ingestion UI present", read("src/app/(protected)/veille/ui.tsx").includes("Ajouter une connaissance à LIA")],
  ["orchestration candidate fallback present", read("src/lib/lia/orchestrator.ts").includes("candidateUseCase")],
  ["native control plane present", read("src/app/api/admin/ai/overview/route.ts").includes("nexora-native")],
  ["knowledge validation migration present", fs.existsSync(path.join(root,"supabase/migrations/0097_admin_knowledge_validation.sql"))],
];
let failed=0;
for (const [name,ok] of checks) { console.log(`${ok?"PASS":"FAIL"} ${name}`); if(!ok) failed++; }
if(failed) process.exit(1);
console.log(`${checks.length-failed}/${checks.length} checks passed.`);
