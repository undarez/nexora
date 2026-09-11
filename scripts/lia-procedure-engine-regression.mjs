import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/lib/lia/procedure-engine.ts', import.meta.url), 'utf8');
assert.match(source, /minimum_autonomy/);
assert.match(source, /human_approval_required/);
assert.match(source, /consentedPersonalization/);
assert.match(source, /stratégie bornée/);
console.log('✓ procedure engine contract');
