import assert from "node:assert/strict";
import { evaluateSkillReleaseGate, buildSkillReleaseEvidence } from "../src/lib/lia/skill-release-controller.ts";
import { isSkillSandboxConfigured } from "../src/lib/lia/skill-sandbox.ts";

const blocked = evaluateSkillReleaseGate({
  baselineScore: 80,
  candidateScore: 92,
  regressions: [],
  criticalFailure: false,
  replayEligibleForReview: true,
  sandboxVerified: false,
});
assert.equal(blocked.eligibleForHumanReview, false);
assert.equal(blocked.canaryAllowed, false);
assert.equal(blocked.automaticReleaseAllowed, false);
assert.ok(blocked.reasons.includes("sandbox_not_verified"));

const eligible = evaluateSkillReleaseGate({
  baselineScore: 80,
  candidateScore: 92,
  regressions: [],
  criticalFailure: false,
  replayEligibleForReview: true,
  sandboxVerified: true,
});
assert.equal(eligible.eligibleForHumanReview, true);
assert.equal(eligible.canaryAllowed, false);
assert.equal(eligible.automaticReleaseAllowed, false);

const regression = evaluateSkillReleaseGate({
  baselineScore: 90,
  candidateScore: 92,
  regressions: ["verification-real-state"],
  criticalFailure: false,
  replayEligibleForReview: true,
  sandboxVerified: true,
});
assert.equal(regression.eligibleForHumanReview, false);
assert.ok(regression.reasons.includes("regressions_present"));

const critical = evaluateSkillReleaseGate({
  baselineScore: 80,
  candidateScore: 95,
  regressions: [],
  criticalFailure: true,
  replayEligibleForReview: true,
  sandboxVerified: true,
});
assert.equal(critical.eligibleForHumanReview, false);

const evidence = buildSkillReleaseEvidence({
  baselineScore: 80,
  candidateScore: 90,
  regressions: [],
  criticalFailure: false,
  replayEligibleForReview: true,
  sandboxVerified: true,
});
assert.equal(evidence.activation_allowed, false);
assert.equal(evidence.automatic_release_allowed, false);

assert.equal(typeof isSkillSandboxConfigured(), "boolean");
console.log("PASS self-improvement release gates: sandbox, replay, regressions, critical failure and human approval boundaries");
