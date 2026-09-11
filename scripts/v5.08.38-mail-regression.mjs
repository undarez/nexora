import fs from 'node:fs';
const required = [
  'src/lib/email/brand.ts','src/lib/email/templates.ts','src/lib/email/resend.ts',
  'src/app/api/auth/resend-confirmation/route.ts',
  'supabase/email-templates/confirmation.html','supabase/email-templates/magic-link.html','supabase/email-templates/reset-password.html','supabase/email-templates/invite.html','supabase/email-templates/change-email.html',
  'supabase/email-templates/README.md'
];
for (const file of required) { if (!fs.existsSync(file)) throw new Error(`missing ${file}`); }
const templates = fs.readFileSync('src/lib/email/templates.ts','utf8');
for (const token of ['confirmationEmail','passwordResetEmail','magicLinkEmail','enterpriseInviteEmail','bankReconnectEmail','securityAlertEmail']) if (!templates.includes(token)) throw new Error(`missing template ${token}`);
const confirmation = fs.readFileSync('supabase/email-templates/confirmation.html','utf8');
if (!confirmation.includes('{{ .ConfirmationURL }}') || !confirmation.includes('NEXORA')) throw new Error('confirmation template invalid');
console.log('V5.08.38 mail regression: 10/10 PASS');
