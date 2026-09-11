import fs from 'node:fs';

const checks = [
  ['readiness public key alignment', 'src/lib/lia/production-readiness.ts', ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']],
  ['signup same-origin', 'src/app/api/auth/signup/route.ts', ['assertSameOrigin(request)', 'rawBody.length > 32_000']],
  ['password reset same-origin', 'src/app/api/auth/password-reset/route.ts', ['assertSameOrigin(request)', 'rawBody.length > 32_000']],
  ['resend confirmation same-origin', 'src/app/api/auth/resend-confirmation/route.ts', ['assertSameOrigin(request)', 'rawBody.length > 32_000']],
  ['security headers', 'next.config.ts', ['Strict-Transport-Security', 'Cross-Origin-Opener-Policy', 'X-DNS-Prefetch-Control']],
  ['api no-store', 'next.config.ts', ['source: "/api/:path*"', 'Cache-Control', 'no-store']],
];
let pass=0;
for (const [label,file,tokens] of checks) {
  if (!fs.existsSync(file)) { console.log(`FAIL ${label}: missing file`); continue; }
  const s=fs.readFileSync(file,'utf8');
  const ok=tokens.every(t=>s.includes(t));
  console.log(`${ok?'PASS':'FAIL'} ${label}`); if(ok) pass++;
}
const authFiles = ['src/app/api/auth/signup/route.ts','src/app/api/auth/password-reset/route.ts','src/app/api/auth/resend-confirmation/route.ts'];
for (const file of authFiles) {
  const s=fs.readFileSync(file,'utf8');
  const ok=s.includes('JSON.parse(rawBody)') && !s.includes('request.json()');
  console.log(`${ok?'PASS':'FAIL'} bounded-json:${file}`); if(ok) pass++;
}
console.log(`\n${pass}/9 checks PASS`);
if(pass!==9) process.exit(1);
