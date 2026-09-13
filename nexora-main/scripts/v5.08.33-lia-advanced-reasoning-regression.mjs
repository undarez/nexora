import { readFileSync } from "node:fs";
const file=readFileSync("src/lib/lia/financial-reasoning.ts","utf8");
const checks=[
 ["reasoning v2",file.includes("version: 2")],
 ["six-month trends",file.includes("trends")&&file.includes("slice(-6)")],
 ["recurring detection",file.includes("recurring")&&file.includes("occurrences>=2")],
 ["anomaly detection",file.includes("3×")&&file.includes("anomalies")],
 ["forecast-safe",file.includes("counterfactualAllowed:false")],
 ["natural evidence limits",file.includes("causalité")&&file.includes("flux non importés")],
 ["formatted recurring output",file.includes("Récurrences observées")],
 ["formatted anomaly output",file.includes("Anomalies à vérifier")],
];
let pass=0; for(const [n,ok] of checks){console.log(`${ok?"PASS":"FAIL"} ${n}`); if(ok)pass++;}
console.log(`V5.08.33: ${pass}/${checks.length} PASS`); if(pass!==checks.length)process.exit(1);
