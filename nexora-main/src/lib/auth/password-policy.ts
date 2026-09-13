export const PASSWORD_POLICY = {
  minLength: 8,
  requiresUppercase: true,
  requiresLowercase: true,
  requiresDigit: true,
  requiresSpecial: true,
} as const;

export type PasswordCheck = {
  valid: boolean;
  minLength: boolean;
  uppercase: boolean;
  lowercase: boolean;
  digit: boolean;
  special: boolean;
};

export function checkPassword(password: string): PasswordCheck {
  const result = {
    minLength: password.length >= PASSWORD_POLICY.minLength,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    digit: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  return { ...result, valid: Object.values(result).every(Boolean) };
}

export function passwordPolicyMessage(password: string) {
  const c = checkPassword(password);
  if (c.valid) return "";
  const missing: string[] = [];
  if (!c.minLength) missing.push("8 caractères minimum");
  if (!c.uppercase) missing.push("1 lettre majuscule");
  if (!c.lowercase) missing.push("1 lettre minuscule");
  if (!c.digit) missing.push("1 chiffre");
  if (!c.special) missing.push("1 caractère spécial");
  return `Le mot de passe doit contenir : ${missing.join(", ")}.`;
}
