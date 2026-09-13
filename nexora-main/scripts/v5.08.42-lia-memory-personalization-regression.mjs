import fs from 'node:fs';
import assert from 'node:assert/strict';

const policy = fs.readFileSync('src/lib/lia/memory-policy.ts','utf8');
const context = fs.readFileSync('src/lib/lia/memory-context.ts','utf8');
const chat = fs.readFileSync('src/app/api/lia/chat/route.ts','utf8');

const checks = [
  ['policy exists', policy.includes('export function classifyLiaMemory')],
  ['personalization consent gate', policy.includes('consentedPersonalization === true')],
  ['accepted gate', policy.includes('status === "accepted"')],
  ['sensitive key filter', policy.includes('SENSITIVE_KEY')],
  ['relationship consent lookup', context.includes('consented_personalization')],
  ['expired memory excluded', context.includes('memory.expires_at')],
  ['personalization filtered', context.includes('!policy.personalization || consentedPersonalization')],
  ['memory sanitized', context.includes('sanitizeMemoryValue')],
  ['candidate remains explicit', context.includes('hasExplicitMemoryIntent(question)')],
  ['candidate not auto accepted', context.includes('status: "candidate"')],
  ['chat still retrieves governed memory', chat.includes('retrieveLiaMemories')],
  ['chat still creates candidates only', chat.includes('activation_allowed: false')],
];
for (const [name, ok] of checks) { assert.ok(ok, name); console.log(`PASS ${name}`); }
console.log(`${checks.length}/${checks.length} PASS`);
