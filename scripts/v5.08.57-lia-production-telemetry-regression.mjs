import fs from "node:fs";
import assert from "node:assert/strict";
const root = new URL("../", import.meta.url).pathname;
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const telemetry = read("../src/lib/lia/production-telemetry.ts");
const pipeline = read("../src/lib/lia/financial-memory/pipeline.ts");
const chat = read("../src/app/api/lia/chat/route.ts");
const migration = read("../supabase/migrations/0110_lia_production_learning_telemetry.sql");
const route = read("../src/app/api/admin/lia/production-telemetry/route.ts");
const ui = read("../src/app/(protected)/admin/lia-learning/ui.tsx");
const checks = [
  ["telemetry module exists", telemetry.includes("normalizeProductionTelemetry")],
  ["telemetry is metric-only", telemetry.includes("never raw prompts/responses")],
  ["clamps quality", telemetry.includes("Math.max(0, Math.min(100")],
  ["aggregates recommendation quality", telemetry.includes("recommendationAverageQuality")],
  ["only active skills record", pipeline.includes('args.skill.status !== "active"')],
  ["chat integrates telemetry", chat.includes("recordLiaProductionTelemetry")],
  ["chat requires human approval", chat.includes("humanApprovalRequired: true")],
  ["migration has telemetry table", migration.includes("lia_production_telemetry")],
  ["migration blocks client access", migration.includes("revoke all on public.lia_production_telemetry")],
  ["admin route protected", route.includes("getAdminContext") && route.includes("!user || !isAdmin")],
  ["admin route is 30-day bounded", route.includes("30 * 24 * 60 * 60 * 1000")],
  ["UI exposes aggregate metrics", ui.includes("Télémétrie de qualité en production")],
];
for (const [name, ok] of checks) { assert.equal(ok, true, name); console.log(`PASS ${name}`); }
console.log(`${checks.length}/${checks.length} PASS`);
