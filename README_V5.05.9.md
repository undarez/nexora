# NEXORA v5.05.9 — Authentication & Password Policy

- Email/password signup now enforces the password policy server-side and client-side.
- Minimum 8 characters.
- At least one uppercase, one lowercase, one digit and one special character.
- Password confirmation required at signup.
- Login continues to use Supabase Auth.
- Added password-reset request flow with a neutral success message to avoid account enumeration.
- Passwords are never stored by the application; Supabase Auth remains responsible for credential storage and hashing.
- Added `scripts/auth-password-regression.mjs`.
