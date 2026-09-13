import assert from "node:assert/strict";
import { runNexoraInquiryKernel } from "../src/lib/lia/inquiry-kernel.ts";

const result = runNexoraInquiryKernel({
  inquiries: [
    { id: "research", kind: "research", question: "Quel est le taux actuel ?", targetUncertainty: "taux", expectedDecisionImpact: 90, evidenceQuality: 85, effort: 25, urgency: 80 },
    { id: "clarify", kind: "clarification", question: "", targetUncertainty: "budget", expectedDecisionImpact: 95, evidenceQuality: 70, effort: 10 },
    { id: "verify", kind: "verification", question: "Vérifier le montant", targetUncertainty: "montant", expectedDecisionImpact: 80, evidenceQuality: 90, effort: 30 },
  ],
});

assert.equal(result.version, 1);
assert.equal(result.selected?.id, "research");
assert.equal(result.nextStep, "research");
assert.equal(result.authority.createsFacts, false);
assert.equal(result.authority.mutatesMemory, false);
assert.equal(result.authority.executesTools, false);
assert.equal(result.authority.authorizesFinancialWrite, false);
assert.equal(result.authority.policyEngineAuthoritative, true);
assert.equal(result.authority.decisionGateAuthoritative, true);
assert.ok(result.invariants.includes("minimal_inquiry_is_preferred"));
console.log("lia:inquiry-kernel PASS");
