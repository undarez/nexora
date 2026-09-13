import fs from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const files = [
 'src/lib/lia/secure-vault.ts',
 'src/app/api/lia/secure-vault/route.ts',
 'src/app/(protected)/coffre/page.tsx',
 'supabase/migrations/0083_financial_secure_vault.sql',
];
for (const file of files) if (!fs.existsSync(root + file)) throw new Error(`Missing ${file}`);
const crypto = fs.readFileSync(root+'src/lib/lia/secure-vault.ts','utf8');
for (const marker of ['aes-256-gcm','NEXORA_VAULT_KEY','auth_tag']) if (!crypto.includes(marker)) throw new Error(`Missing vault marker ${marker}`);
const route = fs.readFileSync(root+'src/app/api/lia/secure-vault/route.ts','utf8');
if (route.includes('decryptVaultPayload')) throw new Error('Browser API must not decrypt vault payloads.');
console.log('lia:secure-vault PASS');
