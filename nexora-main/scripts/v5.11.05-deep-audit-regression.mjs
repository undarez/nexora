import fs from 'node:fs';
import path from 'node:path';

const checks = [];
const exists = (f) => fs.existsSync(f);
const add = (name, ok) => { checks.push([name, !!ok]); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); };

add('package version is current', /^0\.1\.\d+$/.test(JSON.parse(fs.readFileSync('package.json','utf8')).version));
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
const lock = JSON.parse(fs.readFileSync('package-lock.json','utf8')).packages[''];
add('package-lock root matches package.json dependencies', JSON.stringify(lock.dependencies) === JSON.stringify(pkg.dependencies) && JSON.stringify(lock.devDependencies) === JSON.stringify(pkg.devDependencies));
add('no unreferenced legacy client wrapper', !exists('src/lib/client.ts'));
add('no unreferenced legacy server wrapper', !exists('src/lib/server.ts'));
add('no committed TypeScript build cache', !exists('tsconfig.tsbuildinfo'));
add('single package manager lockfile', exists('package-lock.json') && !exists('yarn.lock'));
add('mobile auth boundary exists', exists('src/lib/auth/mobile.ts'));
add('mobile financial context endpoint exists', exists('src/app/api/mobile/context/route.ts'));
add('mobile transactions endpoint exists', exists('src/app/api/mobile/transactions/route.ts'));
add('mobile banking endpoints exist', exists('src/app/api/mobile/banking/status/route.ts') && exists('src/app/api/mobile/banking/connect/route.ts'));
add('android project exists', exists('android/settings.gradle.kts') && exists('android/app/build.gradle.kts') && exists('android/app/src/main/AndroidManifest.xml'));
add('android first-visit is user-scoped', fs.readFileSync('android/app/src/main/java/com/nexora/finance/core/storage/FirstVisitStore.kt','utf8').includes('userId'));
add('android does not contain secret key names', !fs.readFileSync('android/app/build.gradle.kts','utf8').includes('SERVICE_ROLE') && !fs.readFileSync('android/local.properties.example','utf8').includes('SECRET'));
add('android min sdk aligns with supabase kotlin', fs.readFileSync('android/app/build.gradle.kts','utf8').includes('minSdk = 26'));
add('release regression no longer hardcodes 0.1.120', !fs.readFileSync('scripts/v5.11.00-release-candidate-regression.mjs','utf8').includes("=== '0.1.120'"));

const failed = checks.filter(([,ok]) => !ok).length;
console.log(`\n${checks.length-failed}/${checks.length} deep audit checks PASS`);
if (failed) process.exit(1);
