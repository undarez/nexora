import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = 1;

function key(): Buffer {
  const raw = process.env.NEXORA_VAULT_KEY;
  if (!raw) throw new Error("NEXORA_VAULT_KEY manquante: le coffre reste verrouillé.");
  const buf = Buffer.from(raw, /^[0-9a-fA-F]{64}$/.test(raw) ? "hex" : "base64");
  if (buf.length !== 32) throw new Error("NEXORA_VAULT_KEY doit représenter exactement 32 octets.");
  return buf;
}

export function encryptVaultPayload(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { version: VERSION, ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), auth_tag: tag.toString("base64") };
}

export function decryptVaultPayload(row: { ciphertext: string; iv: string; auth_tag: string }) {
  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(row.iv, "base64"));
  decipher.setAuthTag(Buffer.from(row.auth_tag, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(row.ciphertext, "base64")), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as unknown;
}

export function maskSensitiveLabel(label: string) {
  const clean = label.trim();
  if (clean.length <= 4) return "••••";
  return `${clean.slice(0, 2)}${"•".repeat(Math.min(8, Math.max(3, clean.length - 4)))}${clean.slice(-2)}`;
}
