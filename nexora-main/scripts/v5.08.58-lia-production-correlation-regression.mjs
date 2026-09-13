import { correlateProductionLearning } from "../src/lib/lia/production-correlation.ts";
const rows=[
 {skillId:"s",skillVersionId:"v1",qualityScore:80,verdict:"accepted",corrected:false,recommendationGenerated:true,evidenceCount:2,createdAt:"2026-09-01T10:00:00Z"},
{skillId:"s",skillVersionId:"v1",qualityScore:80,verdict:"accepted",corrected:false,recommendationGenerated:true,evidenceCount:2,createdAt:"2026-09-01T10:00:00Z"},
{skillId:"s",skillVersionId:"v1",qualityScore:80,verdict:"accepted",corrected:false,recommendationGenerated:true,evidenceCount:2,createdAt:"2026-09-01T10:00:00Z"},
{skillId:"s",skillVersionId:"v1",qualityScore:80,verdict:"accepted",corrected:false,recommendationGenerated:true,evidenceCount:2,createdAt:"2026-09-01T10:00:00Z"},
{skillId:"s",skillVersionId:"v1",qualityScore:80,verdict:"accepted",corrected:false,recommendationGenerated:true,evidenceCount:2,createdAt:"2026-09-01T10:00:00Z"},
 {skillId:"s",skillVersionId:"v2",qualityScore:86,verdict:"accepted",corrected:false,recommendationGenerated:true,evidenceCount:3,createdAt:"2026-09-02T10:00:00Z"},
 {skillId:"s",skillVersionId:"v2",qualityScore:88,verdict:"accepted",corrected:false,recommendationGenerated:true,evidenceCount:3,createdAt:"2026-09-03T10:00:00Z"},
 {skillId:"s",skillVersionId:"v2",qualityScore:87,verdict:"accepted",corrected:false,recommendationGenerated:false,evidenceCount:2,createdAt:"2026-09-04T10:00:00Z"},
 {skillId:"s",skillVersionId:"v2",qualityScore:89,verdict:"accepted",corrected:false,recommendationGenerated:true,evidenceCount:4,createdAt:"2026-09-05T10:00:00Z"},
 {skillId:"s",skillVersionId:"v2",qualityScore:88,verdict:"accepted",corrected:false,recommendationGenerated:true,evidenceCount:4,createdAt:"2026-09-06T10:00:00Z"},
];
const out=correlateProductionLearning(rows,[{skillId:"s",versionId:"v2",previousVersionId:"v1",createdAt:"2026-09-02T09:00:00Z",status:"active"}]);
const r=out.reports.find(x=>x.skillVersionId==="v2");
if(!r) throw new Error("v2 report missing");
const tests=[
 ["version-scoped",r.skillVersionId==="v2"], ["baseline-linked",r.previousVersionId==="v1"], ["quality-delta",r.deltas.qualityScore===7.6],
 ["observational-only",r.attribution==="observational_only"], ["no-auto-learning",out.policy.automaticLearning===false], ["no-auto-promotion",out.policy.automaticPromotion===false], ["no-auto-activation",out.policy.automaticActivation===false], ["no-auto-rollback",out.policy.automaticRollback===false], ["positive-signal",r.signal==="positive_signal"], ["low-confidence-small-sample",r.confidence==="low"]
];
let failed=0; for(const [n,ok] of tests){console.log(`${ok?"PASS":"FAIL"} ${n}`);if(!ok)failed++;} if(failed) process.exit(1); console.log(`${tests.length}/${tests.length} PASS`);
