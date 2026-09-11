import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'src/app/a-propos/page.tsx', 'src/app/contact/page.tsx', 'src/app/faq/page.tsx',
  'src/app/rgpd/page.tsx', 'src/app/cookies/page.tsx', 'src/app/mentions-legales/page.tsx',
  'src/app/conditions-generales/page.tsx', 'src/app/charte/page.tsx', 'src/app/cgv/page.tsx',
  'src/components/legal/privacy-controls.tsx', 'src/lib/legal/config.ts', 'src/components/footer.tsx'
];
const failures = [];
for (const file of required) if (!fs.existsSync(path.join(root, file))) failures.push(`missing:${file}`);
const footer = fs.readFileSync(path.join(root, 'src/components/footer.tsx'), 'utf8');
for (const href of ['/a-propos','/contact','/faq','/rgpd','/cookies','/mentions-legales','/conditions-generales','/charte','/cgv']) {
  if (!footer.includes(`href="${href}"`)) failures.push(`footer-link:${href}`);
}
const cfg = fs.readFileSync(path.join(root, 'src/lib/legal/config.ts'), 'utf8');
for (const key of ['NEXT_PUBLIC_LEGAL_ENTITY_NAME','NEXT_PUBLIC_LEGAL_ADDRESS','NEXT_PUBLIC_CONTACT_EMAIL','NEXT_PUBLIC_PRIVACY_EMAIL']) {
  if (!cfg.includes(key)) failures.push(`legal-config:${key}`);
}
if (failures.length) { console.error('LEGAL PAGES REGRESSION: FAIL'); failures.forEach(x => console.error(`- ${x}`)); process.exit(1); }
console.log('LEGAL PAGES REGRESSION: PASS');
console.log(`Verified ${required.length} required legal/product files and footer navigation.`);
