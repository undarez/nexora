import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const required = [
  "src/lib/lia/financial-memory/pipeline.ts",
  "src/lib/lia/financial-memory/governance.ts",
  "src/lib/agent-runtime/executor.ts",
  "src/app/api/lia/chat/route.ts",
  "supabase/migrations/0078_financial_agent_memory_v2.sql",
  "knowledge/pipelines/financial-agent-memory-v2/README.md",
  "knowledge/pipelines/financial-agent-memory-v2/config/v2_pipeline_policy.json",
];
for (const file of required) {
  if (!fs.existsSync(path.join(root,file))) throw new Error(`missing:${file}`);
}
const sql=fs.readFileSync(path.join(root,"supabase/migrations/0078_financial_agent_memory_v2.sql"),"utf8");
for (const token of ["financial_memory_versions","agent_decision_gates","agent_behaviour_events","financial_agent_drift_signals","version_lia_memory","rollback_lia_memory_to_last_validated","record_agent_decision_gate"]) {
  if (!sql.includes(token)) throw new Error(`missing_sql:${token}`);
}
const pipeline=fs.readFileSync(path.join(root,"src/lib/lia/financial-memory/pipeline.ts"),"utf8");
if (!pipeline.includes('createAdminClient')) throw new Error("pipeline_admin_client_missing");
const executor=fs.readFileSync(path.join(root,"src/lib/agent-runtime/executor.ts"),"utf8");
if (!executor.includes("recordDecisionGate")) throw new Error("executor_gate_missing");
if (!executor.includes("recordFinancialBehaviourEvent")) throw new Error("executor_behaviour_missing");
const policy=JSON.parse(fs.readFileSync(path.join(root,"knowledge/pipelines/financial-agent-memory-v2/config/v2_pipeline_policy.json"),"utf8"));
if (policy.principles.knowledge_is_not_authorization !== true) throw new Error("knowledge_authorization_policy_invalid");
console.log("lia-financial-memory-v2: PASS");
