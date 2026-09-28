import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("src/app/api/lia/chat/route.ts", "utf8");
const orchestration = readFileSync("src/lib/lia/research-orchestration.ts", "utf8");
const live = readFileSync("src/lib/lia/research/live/index.ts", "utf8");
const evidence = readFileSync("src/lib/lia/research/evidence.ts", "utf8");
const gateway = readFileSync("src/lib/lia/research/gateway/index.ts", "utf8");

assert.match(route, /runLiaResearchEvidence/);
assert.doesNotMatch(route, /runLiveResearch\(/);
assert.doesNotMatch(route, /external_research_evidence/);

assert.match(orchestration, /runLiveResearch\(/);
assert.match(orchestration, /recordAgentLoopStep/);
assert.match(orchestration, /recordEvidence/);
assert.match(orchestration, /minimumEvidenceMet/);
assert.doesNotMatch(orchestration, /NextResponse|createClient\(\)/);
assert.doesNotMatch(orchestration, /\.from\(["'](?:accounts|transactions|bank_accounts|budgets|goals|forecasts|financial_[^"']*)["']\)/);

assert.match(live, /discoverTrustedSources/);
assert.match(live, /getResearchDomainPolicy/);
assert.match(live, /acquireSource/);
assert.match(evidence, /activationAllowed:false/);
assert.match(evidence, /minimumEvidenceMet/);
assert.match(gateway, /private_ip_blocked/);
assert.match(gateway, /redirect_limit/);

console.log("PASS LIA research/evidence boundary: acquisition, adjudication, and evidence telemetry are delegated without authority expansion.");
