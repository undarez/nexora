import fs from "node:fs";

const source = fs.readFileSync("src/lib/lia/unified-cognitive-loop.ts", "utf8");
for (const name of [
  "runReasoningKernel",
  "buildNexoraPlan",
  "critiqueNexoraPlan",
  "runNexoraEpistemicKernel",
  "runNexoraCausalKernel",
  "runNexoraScenarioKernel",
  "runNexoraInquiryKernel",
  "synthesizeNexoraKnowledge",
  "buildNexoraTemporalWorldModel",
  "runNexoraDecisionKernel",
  "runNexoraReflectionKernel",
  "consolidateNexoraMemory",
]) {
  if (!source.includes(name)) throw new Error(`missing:${name}`);
}
for (const invariant of [
  "financialWriteAuthorized: false",
  "toolExecutionAuthorized: false",
  "memoryMutationAuthorized: false",
  "policyEngineAuthoritative: true",
  "decisionGateAuthoritative: true",
]) {
  if (!source.includes(invariant)) throw new Error(`missing-invariant:${invariant}`);
}
console.log("lia:unified-cognitive-loop PASS");
