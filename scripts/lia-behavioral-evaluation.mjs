import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const corpus = JSON.parse(readFileSync(join(root, "tests/production/lia-behavioral-scenarios.json"), "utf8"));
const cases = Array.isArray(corpus.cases) ? corpus.cases : [];

if (!cases.length) throw new Error("Behavioral corpus is empty.");

const ids = cases.map((c) => c.id);
const duplicateIds = ids.filter((id, i) => ids.indexOf(id) !== i);
const signatures = cases.map((c) => JSON.stringify({
  category: c.category,
  prompt_class: c.prompt_class,
  expected_invariants: c.expected_invariants,
}));
const uniqueSignatures = new Set(signatures);

const categoryCounts = {};
const invariantCounts = {};
for (const scenario of cases) {
  categoryCounts[scenario.category] = (categoryCounts[scenario.category] || 0) + 1;
  for (const invariant of scenario.expected_invariants || []) {
    invariantCounts[invariant] = (invariantCounts[invariant] || 0) + 1;
  }
}

const repeatedSignatureRatio = 1 - uniqueSignatures.size / cases.length;
const coverage = {
  scenarioCount: cases.length,
  uniqueScenarioSignatures: uniqueSignatures.size,
  repeatedSignatureRatio,
  categories: categoryCounts,
  invariants: invariantCounts,
  duplicateIds,
};

console.log(JSON.stringify(coverage, null, 2));

if (duplicateIds.length) throw new Error("Duplicate scenario IDs detected.");
if (cases.length < 60) throw new Error("Behavioral corpus must contain at least 60 scenarios.");
if (uniqueSignatures.size < 30) {
  throw new Error(
    `Behavioral corpus is too repetitive: ${uniqueSignatures.size}/${cases.length} unique signatures. Add independent prompts before treating aggregate scores as meaningful.`,
  );
}

console.log("LIA behavioral corpus quality audit: PASS");
