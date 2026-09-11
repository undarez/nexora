'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

function sessionId() {
  try {
    const key = 'nexora.analytics.session';
    const existing = window.localStorage.getItem(key);
    if (existing && /^[A-Za-z0-9_-]{16,80}$/.test(existing)) return existing;
    const value = `${crypto.randomUUID().replaceAll('-', '')}_${Date.now().toString(36)}`;
    window.localStorage.setItem(key, value);
    return value;
  } catch { return null; }
}

function featureForRoute(pathname: string) {
  const p = pathname.split('?')[0].split('#')[0];
  const rules: Array<[RegExp, string]> = [
    [/^\/dashboard$/, 'dashboard'], [/^\/transactions/, 'transactions'], [/^\/budget/, 'budget'],
    [/^\/previsions/, 'forecasts'], [/^\/pilotage/, 'pilotage'], [/^\/objectifs/, 'goals'],
    [/^\/banque/, 'banking'], [/^\/entreprise/, 'enterprise'], [/^\/lia/, 'lia'],
    [/^\/coffre/, 'vault'], [/^\/notifications/, 'notifications'],
  ];
  return rules.find(([regex]) => regex.test(p))?.[1] ?? null;
}

export function ProductAnalyticsTracker() {
  const pathname = usePathname();
  useEffect(() => {
    const sid = sessionId();
    if (!sid || !pathname) return;
    const feature = featureForRoute(pathname);
    const payloads = [
      { event_name: 'page_view', route: pathname, session_id: sid },
      ...(feature ? [{ event_name: 'feature_view', route: pathname, session_id: sid, feature_key: feature }] : []),
    ];
    void Promise.all(payloads.map((payload) => fetch('/api/analytics', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), keepalive: true,
    }).catch(() => undefined)));
  }, [pathname]);
  return null;
}
