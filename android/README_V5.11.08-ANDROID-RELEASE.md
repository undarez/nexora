# NEXORA Android V5.11.08 — Release hardening

## Changes
- Lifecycle-aware Compose state collection.
- HTTPS required for release builds.
- Cleartext HTTP disabled at manifest/network-security level.
- Better HTTP error mapping (401/403/408/429/5xx).
- Client input policy hardened for malformed email addresses.
- Android test dependencies prepared for Compose UI tests.
- Version code 3 / version name 0.1.2.
- Existing PKCE, Bearer auth, server-side Powens boundary and no-service-role mobile architecture preserved.

## Release procedure
1. Create `android/local.properties` from `local.properties.example`.
2. Set production `SUPABASE_URL`, publishable key and an HTTPS `NEXORA_BASE_URL`.
3. Open the `android/` folder in Android Studio.
4. Sync Gradle.
5. Run unit tests and instrumented/Compose tests on a physical device.
6. Test sign-in, logout, resume, banking authorization/return, transaction loading, enterprise access and LIA error/timeout paths.
7. Configure a release signing key outside source control.
8. Build the signed AAB with `bundleRelease`.
9. Upload to Play Console internal testing before production.

## Play Store production gates
- Privacy policy URL and Data Safety declaration reviewed.
- Account deletion flow documented if required by the chosen account model.
- App content / target audience declarations completed.
- Store screenshots and feature graphic prepared.
- Production backend uses HTTPS only.
- No service-role, Stripe secret or Powens secret is present in the APK/AAB.
- Deep-link return from Powens tested on a real device.
- Crash/ANR monitoring enabled before public rollout.

## Build limitation in this environment
The archive is source-complete, but an Android SDK/Gradle installation is not available in this execution environment, so no APK/AAB is claimed as successfully compiled here.
