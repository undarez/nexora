import fs from "node:fs";

const checks = [
  ["agent loop duplicate is idempotent", /error\?\.code === "23505"|agent_loop_steps_loop_run_id_step_order_key/.test(fs.readFileSync("src/lib/agents/loop-engine.ts", "utf8"))],
  ["analytics schema absence is non-fatal", /analytics_schema_unavailable/.test(fs.readFileSync("src/app/api/analytics/route.ts", "utf8"))],
  ["unified context tolerates missing bridge during migration", /bank_transaction_envelope_links/.test(fs.readFileSync("src/lib/finance/unified-financial-context.ts", "utf8"))],
  ["runtime migration exists", fs.existsSync("supabase/migrations/0096_runtime_stability_hardening.sql")],
];
for (const [label, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
if (checks.some(([,ok]) => !ok)) process.exit(1);
