import { buildLiaRecommendation } from "../src/lib/lia/recommendation-engine.ts";

const base = { objective: "Que faire ?", balance: 2000, income90d: 6000, expense90d: 4500, transactionCount: 40, hasBudget: true, confidenceScore: 0.9 };
const positive = buildLiaRecommendation(base);
if (!positive.humanApprovalRequired || positive.actionability !== "user_decision") throw new Error("recommendation must remain human decision");
if (!positive.facts.length || !positive.options.length || !positive.limitations.length) throw new Error("missing decision structure");
const deficit = buildLiaRecommendation({ ...base, income90d: 3000, expense90d: 6000, balance: 500 });
if (!['high','critical'].includes(deficit.priority)) throw new Error("deficit priority not elevated");
if (!deficit.risks.length) throw new Error("risk section missing");
const empty = buildLiaRecommendation({ ...base, income90d: 0, expense90d: 0, transactionCount: 0, hasBudget: false });
if (empty.confidence !== 'low' || !empty.limitations.length) throw new Error("low-evidence guardrail failed");
console.log("V5.08.43 regression: 7/7 PASS");
