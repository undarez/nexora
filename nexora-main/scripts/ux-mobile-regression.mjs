import { readFileSync } from "node:fs";

const css = readFileSync("src/app/globals.css", "utf8");
const required = [
  "v5.05.4 — UX/UI + mobile hardening",
  "focus-visible",
  "min-width:640px",
  "env(safe-area-inset-bottom)",
  "prefers-reduced-motion:reduce",
];
for (const needle of required) {
  if (!css.includes(needle)) throw new Error(`Missing UX/mobile guard: ${needle}`);
}
console.log("✓ UX/mobile regression contract");
