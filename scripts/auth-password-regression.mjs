import fs from 'node:fs';
const policy = fs.readFileSync(new URL('../src/lib/auth/password-policy.ts', import.meta.url), 'utf8');
for (const rule of ['minLength: 8','/[A-Z]/','/[a-z]/','/\\d/','/[^A-Za-z0-9]/']) if (!policy.includes(rule)) throw new Error(`Missing password rule: ${rule}`);
const route = fs.readFileSync(new URL('../src/app/api/auth/signup/route.ts', import.meta.url), 'utf8');
for (const token of ['checkPassword(password).valid','passwordPolicyMessage(password)','supabase.auth.signUp']) if (!route.includes(token)) throw new Error(`Missing server enforcement: ${token}`);
console.log('v5.05.9 auth password regression: PASS');
