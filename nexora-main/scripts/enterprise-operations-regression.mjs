import fs from 'node:fs';
const required = [
  ['new enterprise dashboard', 'src/components/enterprise/enterprise-dashboard.tsx'],
  ['new enterprise context', 'src/lib/enterprise/dashboard-context.ts'],
  ['enterprise page', 'src/app/(protected)/entreprise/page.tsx'],
];
for (const [name, rel] of required) { if (!fs.existsSync(rel)) throw new Error(`FAIL ${name}`); console.log(`OK ${name}`); }
const page = fs.readFileSync('src/components/enterprise/enterprise-dashboard.tsx','utf8');
if (!page.includes('Prévisionnel') || !page.includes('IA financière') || !page.includes('Clients & fournisseurs')) throw new Error('FAIL enterprise sections');
if (page.includes('business_financial_obligations')) throw new Error('FAIL legacy obligations dependency');
console.log('Enterprise operations regression: PASS');
