import fs from "node:fs";
const files = [
  "src/lib/lia/voice/gateway.ts",
  "src/app/api/lia/voice/synthesize/route.ts",
];
for (const file of files) if (!fs.existsSync(file)) throw new Error(`${file} missing`);
const gateway = fs.readFileSync(files[0], "utf8");
if (!gateway.includes("HUME_API_KEY") || !gateway.includes("ELEVENLABS_API_KEY")) throw new Error("Voice providers missing");
console.log("LIA voice regression: PASS");
