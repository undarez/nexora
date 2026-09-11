import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const siret = readFileSync('src/lib/business/siret.ts', 'utf8');
assert.match(siret, /function isValidSiret/);
assert.match(siret, /sum % 10 === 0/);
const route = readFileSync('src/app/api/workspaces/onboard/route.ts', 'utf8');
assert.match(route, /recherche-entreprises\.api\.gouv\.fr/);
assert.match(route, /financial_workspaces/);
assert.match(route, /business_profiles/);
const onboarding = readFileSync('src/app/onboarding/page.tsx', 'utf8');
assert.match(onboarding, /Entreprise/);
assert.match(onboarding, /SIRET/);
console.log('Enterprise foundation regression: OK');
