import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const android = path.join(root, 'android');
const checks = [
  ['Android project exists', fs.existsSync(path.join(android, 'settings.gradle.kts'))],
  ['Release minification enabled', fs.readFileSync(path.join(android, 'app/build.gradle.kts'), 'utf8').includes('isMinifyEnabled = true')],
  ['Release HTTPS guard', fs.readFileSync(path.join(android, 'app/src/main/java/com/nexora/finance/core/network/NexoraApi.kt'), 'utf8').includes('baseUrl.startsWith("https://")')],
  ['Cleartext disabled', fs.readFileSync(path.join(android, 'app/src/main/AndroidManifest.xml'), 'utf8').includes('android:usesCleartextTraffic="false"')],
  ['PKCE enabled', fs.readFileSync(path.join(android, 'app/src/main/java/com/nexora/finance/core/auth/SupabaseProvider.kt'), 'utf8').includes('FlowType.PKCE')],
  ['No service role literal in Android', !fs.readdirSync(path.join(android, 'app/src/main/java/com/nexora/finance'), {recursive:true, withFileTypes:false}).filter(f => f.endsWith('.kt')).some(f => fs.readFileSync(path.join(android, 'app/src/main/java/com/nexora/finance', f), 'utf8').includes('service_role'))],
  ['Input tests present', fs.existsSync(path.join(android, 'app/src/test/java/com/nexora/finance/core/MobileInputPolicyTest.kt'))],
];
let failed=0;
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if(!ok) failed++; }
console.log(`Result: ${checks.length-failed}/${checks.length} PASS`);
process.exitCode = failed ? 1 : 0;
