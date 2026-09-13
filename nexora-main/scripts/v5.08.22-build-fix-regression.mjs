import fs from 'node:fs';

const checks = [
  ['transactions bank link state', 'src/app/(protected)/transactions/page.tsx', 'const [bankLinks, setBankLinks] = useState<BankLink[]>([]);'],
  ['unified context version', 'src/lib/finance/unified-financial-context.ts', 'version: 4,'],
  ['unified context weeks_remaining query', 'src/lib/finance/unified-financial-context.ts', 'weeks_remaining,envelopes'],
  ['unified context single intelligence block', 'src/lib/finance/unified-financial-context.ts', 'intelligence:'],
  ['powens token return typing', 'src/lib/banking/powens-adapter.ts', 'Promise<{ token: string; idUser: number }>'],
  ['powens pagination page typing', 'src/lib/banking/powens-adapter.ts', 'const page: Record<string, unknown>'],
];

for (const [label, file, needle] of checks) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(needle)) throw new Error(`FAIL ${label}`);
}

const unified = fs.readFileSync('src/lib/finance/unified-financial-context.ts', 'utf8');
if ((unified.match(/\n    intelligence: \{/g) ?? []).length !== 1) {
  throw new Error('FAIL duplicate intelligence property');
}

console.log(`PASS ${checks.length} build-fix checks`);
