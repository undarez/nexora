let lastRefreshAt = 0;
let refreshPromise: Promise<void> | null = null;

/** Keep deterministic notification refreshes cheap when several realtime signals arrive together. */
export function refreshNotifications(options: { force?: boolean; minIntervalMs?: number } = {}) {
  const minIntervalMs = options.minIntervalMs ?? 15_000;
  const now = Date.now();
  if (!options.force && now - lastRefreshAt < minIntervalMs) return Promise.resolve();
  if (refreshPromise) return refreshPromise;
  lastRefreshAt = now;
  refreshPromise = fetch("/api/notifications/refresh", { method: "POST" })
    .then(() => undefined)
    .catch(() => undefined)
    .finally(() => { refreshPromise = null; });
  return refreshPromise;
}
