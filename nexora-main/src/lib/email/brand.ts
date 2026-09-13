export const NEXORA_EMAIL_NAME = "NEXORA";
export const NEXORA_EMAIL_FROM = process.env.NEXORA_EMAIL_FROM || "NEXORA <no-reply@nexora.finance>";

export function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[char] || char));
}

export function emailLayout(title: string, preheader: string, body: string, cta?: { label: string; href: string }) {
  const button = cta ? `<p style="margin:28px 0"><a href="${cta.href}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:13px 20px;border-radius:10px;font-weight:700">${cta.label}</a></p>` : "";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title></head><body style="margin:0;background:#f5f7fb;color:#111827;font-family:Inter,Arial,sans-serif"><span style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</span><div style="padding:32px 16px"><div style="max-width:620px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden"><div style="padding:24px 28px;border-bottom:1px solid #eef0f4"><div style="font-size:22px;font-weight:800;letter-spacing:-.02em">NEXORA</div><div style="font-size:12px;color:#6b7280;margin-top:4px">Votre pilotage financier, simplement.</div></div><div style="padding:30px 28px"><h1 style="font-size:24px;margin:0 0 16px">${escapeHtml(title)}</h1>${body}${button}</div><div style="padding:18px 28px;background:#fafafa;color:#6b7280;font-size:12px;line-height:1.6">Cet email est envoyé par NEXORA. Si vous n’êtes pas à l’origine de cette demande, vous pouvez l’ignorer. Ne partagez jamais un lien de sécurité reçu par email.</div></div></div></body></html>`;
}
