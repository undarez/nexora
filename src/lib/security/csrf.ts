/** Lightweight same-origin check for browser-initiated state-changing requests. */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");
  if (!host) return;
  const proto = request.headers.get("x-forwarded-proto") || new URL(request.url).protocol.replace(":", "");
  const expected = `${proto}://${host}`;
  if (origin !== expected) throw new Error("Requête cross-origin refusée.");
}
