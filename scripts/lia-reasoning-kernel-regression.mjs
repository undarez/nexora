import fs from "node:fs";
import path from "node:path";

const file = path.resolve("src/lib/lia/reasoning-kernel.ts");
const source = fs.readFileSync(file, "utf8");
const required = [
  'export function runReasoningKernel',
  'model_is_advisory_only',
  'critical_actions_require_human_validation',
  'knowledge_and_memory_are_not_authorization',
  '"external_research"',
  '"human_gate"',
  'missingEvidence:',
];
for (const token of required) {
  if (!source.includes(token)) throw new Error(`Reasoning Kernel regression failed: ${token}`);
}
const route = fs.readFileSync(path.resolve("src/app/api/lia/chat/route.ts"), "utf8");
for (const token of ['runReasoningKernel', 'lia:reasoning-kernel', 'reasoningPrompt', 'reasoning,']) {
  if (!route.includes(token)) throw new Error(`Chat integration regression failed: ${token}`);
}
console.log("✓ NEXORA Reasoning Kernel regression passed");
