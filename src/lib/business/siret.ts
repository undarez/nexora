export function normalizeSiret(value: string) {
  return value.replace(/\D/g, "").slice(0, 14);
}

/** French SIRET control (Luhn variant used by SIRENE). */
export function isValidSiret(value: string) {
  const siret = normalizeSiret(value);
  if (!/^\d{14}$/.test(siret)) return false;
  let sum = 0;
  for (let i = 0; i < siret.length; i += 1) {
    let digit = Number(siret[i]);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

export function formatSiret(value: string) {
  const siret = normalizeSiret(value);
  return siret.length === 14 ? `${siret.slice(0, 3)} ${siret.slice(3, 6)} ${siret.slice(6, 9)} ${siret.slice(9, 14)}` : value;
}
