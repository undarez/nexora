import { NEXORA_EMAIL_FROM } from "./brand";

export async function sendNexoraEmail(input: { to: string; subject: string; html: string; text?: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false as const, configured: false as const, error: "RESEND_API_KEY is not configured" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: NEXORA_EMAIL_FROM, to: [input.to], subject: input.subject, html: input.html, text: input.text }),
  });
  if (!response.ok) return { ok: false as const, configured: true as const, error: await response.text() };
  const data = await response.json().catch(() => ({}));
  return { ok: true as const, configured: true as const, id: data.id as string | undefined };
}
