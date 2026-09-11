import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const route=fs.readFileSync(path.join(root,'src/app/api/lia/chat/route.ts'),'utf8');
const conv=fs.readFileSync(path.join(root,'src/lib/lia/conversation.ts'),'utf8');
const checks=[
 ['conversation module exists',conv.includes('detectLiaConversationIntent')],
 ['wellbeing response exists',conv.includes('Je vais bien, merci')],
 ['greeting response exists',conv.includes('Bonjour')],
 ['financial lane exists',conv.includes('financial')],
 ['chat route imports conversation',route.includes('@/lib/lia/conversation')],
 ['conversation lane avoids financial context',route.includes('financialContextUsed: false')],
 ['provider can answer small talk',route.includes('LIA_CONVERSATION_SYSTEM_PROMPT')],
 ['financial prompt preserves natural interaction',route.includes('RÈGLES D’INTERACTION LIA')],
];
let ok=0; for(const [name,pass] of checks){console.log(`${pass?'PASS':'FAIL'} ${name}`); if(pass)ok++;}
if(ok!==checks.length) process.exit(1); console.log(`V5.08.31 conversation: ${ok}/${checks.length} PASS`);
