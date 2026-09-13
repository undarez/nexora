import { readFileSync } from "node:fs";

const cache = readFileSync("src/lib/lia/cache.ts", "utf8");
const procedures = readFileSync("src/lib/lia/procedure-engine.ts", "utf8");
const chat = readFileSync("src/app/api/lia/chat/route.ts", "utf8");

for (const needle of [
  "MAX_ENTRIES = 128",
  "memoizeLia",
  "60_000",
]) {
  if (!cache.includes(needle) && !procedures.includes(needle)) {
    throw new Error(`Missing bounded cache guard: ${needle}`);
  }
}

if (!chat.includes("Promise.all")) throw new Error("Expected parallel financial reads");
if (chat.includes("setTimeout(")) throw new Error("Unexpected artificial delay in chat route");

console.log("✓ LIA cost optimization contract");
