import { readFileSync } from "node:fs";
const pilotage = readFileSync("src/app/(protected)/pilotage/page.tsx","utf8");
const css = readFileSync("src/app/globals.css","utf8");
if (!pilotage.includes("Promise.allSettled")) throw new Error("Pilotage network calls are not parallelized");
if (pilotage.includes('await fetch("/api/lia/financial-watch",{method:"POST"')) {
  throw new Error("Pilotage should not refresh financial-watch during initial load");
}
if (!css.includes("v5.05.4 — UX/UI + mobile hardening")) throw new Error("UX layer missing");
console.log("✓ functional optimization regression contract");
