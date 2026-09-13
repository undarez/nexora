import { readFileSync } from "node:fs";
const files=[
  "knowledge/skills/financial-agent-intelligence/SKILL.md",
  "knowledge/skills/financial-agent-intelligence/extracted_knowledge_v2.md",
  "knowledge/skills/financial-agent-intelligence/agent_policies_v2.json",
  "knowledge/skills/financial-agent-intelligence/source_registry.json",
  "knowledge/skills/financial-agent-intelligence/agent_tests.json",
];
for (const f of files) {
  const s=readFileSync(f,"utf8");
  if (!s.trim()) throw new Error(`empty intelligence asset: ${f}`);
}
const skill=readFileSync(files[0],"utf8");
for (const token of ["bounded autonomy","Memory safety","Decision protocol","Evidence before action","Source hierarchy"]) {
  if (!skill.includes(token)) throw new Error(`missing skill principle: ${token}`);
}
const knowledge=readFileSync(files[1],"utf8");
for (const token of ["closed-loop systems","Tool safety","Liquidity/cash-management automation","Observability is a first-class agent capability"]) {
  if (!knowledge.includes(token)) throw new Error(`missing knowledge claim: ${token}`);
}
const policies=JSON.parse(readFileSync(files[2],"utf8"));
if (!Array.isArray(policies) || policies.length < 5) throw new Error("insufficient agent policies");
const tests=JSON.parse(readFileSync(files[4],"utf8"));
if (!Array.isArray(tests) || tests.length < 10) throw new Error("insufficient agent tests");
console.log("✓ financial agent intelligence skill contract");
