import fs from 'node:fs'; import path from 'node:path';
const root=process.cwd();
const migration=fs.readFileSync(path.join(root,'supabase/migrations/0100_lia_conversation_knowledge_seed.sql'),'utf8');
const doc=fs.readFileSync(path.join(root,'docs/lia/LIA_CONVERSATION_AND_FINANCIAL_KNOWLEDGE.md'),'utf8');
const checks=[
 ['knowledge migration exists',migration.includes('financial_knowledge_items')],
 ['AMF risk source seeded',migration.includes('amf-actions-risk-2023')],
 ['AMF diversification source seeded',migration.includes('amf-diversification-2023')],
 ['AMF horizon source seeded',migration.includes('amf-savings-goal')],
 ['CNIL source seeded',migration.includes('cnil-ai-minimisation')],
 ['knowledge is validated',migration.includes("status='validated'")],
 ['conversation documentation exists',doc.includes('Interaction naturelle')],
 ['knowledge hierarchy documented',doc.includes('Hiérarchie des connaissances')],
 ['governance documented',doc.includes('Gouvernance et données')],
];
let ok=0; for(const [name,pass] of checks){console.log(`${pass?'PASS':'FAIL'} ${name}`); if(pass)ok++;}
if(ok!==checks.length) process.exit(1); console.log(`V5.08.31 knowledge: ${ok}/${checks.length} PASS`);
