import fs from "node:fs";
import assert from "node:assert/strict";

const migration = fs.readFileSync("supabase/migrations/0077_financial_agent_memory_pipeline.sql", "utf8");
const pipeline = fs.readFileSync("src/lib/lia/financial-memory/pipeline.ts", "utf8");
const chat = fs.readFileSync("src/app/api/lia/chat/route.ts", "utf8");
const proactive = fs.readFileSync("src/lib/lia/proactive/loop.ts", "utf8");

for (const table of ["financial_knowledge_sources","financial_knowledge_documents","financial_knowledge_chunks","financial_knowledge_items","financial_knowledge_evidence","agent_knowledge_retrievals","financial_knowledge_conflicts","lia_financial_habits"]) {
  assert.match(migration, new RegExp(`create table if not exists public\\.${table}`), `${table} absent`);
}
assert.match(migration, /alter table public\.lia_financial_habits enable row level security/);
assert.match(migration, /knowledge_does_not_authorize|Knowledge is evidence/i);
assert.match(migration, /status='validated'/);
assert.match(migration, /search_financial_knowledge/);
assert.match(pipeline, /learnFinancialHabits/);
assert.match(pipeline, /buildLiaBrainContext/);
assert.match(pipeline, /recordFinancialBrainOutcome/);
assert.match(chat, /buildLiaBrainContext/);
assert.match(chat, /CERVEAU FINANCIER GOUVERNÉ/);
assert.match(proactive, /financial-agent-intelligence|buildLiaBrainContext/);
assert.match(proactive, /human_approval_required/);
console.log("lia-financial-memory-regression: PASS");
