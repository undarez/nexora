export type ReadinessLevel = 'ready' | 'warning' | 'blocked';

export type ReadinessCheck = {
  id: string;
  label: string;
  level: ReadinessLevel;
  detail: string;
};

function envCheck(id: string, label: string, names: string[], required = true): ReadinessCheck {
  const configured = names.some((name) => Boolean(process.env[name]?.trim()));
  if (configured) return { id, label, level: 'ready', detail: `Configuration serveur présente (${names.join(' / ')}).` };
  return {
    id,
    label,
    level: required ? 'blocked' : 'warning',
    detail: required ? `Variable serveur requise absente : ${names.join(' ou ')}.` : `Configuration optionnelle absente : ${names.join(' ou ')}.`,
  };
}

/**
 * Production readiness is deliberately a server-side control-plane projection.
 * It reports configuration gates but never returns secret values.
 */
export function buildLiaProductionReadiness(): {
  level: ReadinessLevel;
  checks: ReadinessCheck[];
  generatedAt: string;
} {
  const checks: ReadinessCheck[] = [
    envCheck('supabase-url', 'Supabase URL', ['NEXT_PUBLIC_SUPABASE_URL']),
    envCheck('supabase-public', 'Supabase public key', ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']),
    envCheck('supabase-service', 'Supabase service role', ['SUPABASE_SERVICE_ROLE_KEY']),
    envCheck('admin-emails', 'Admin control plane', ['ADMIN_EMAILS']),
    envCheck('brain-auth', 'NEXORA Brain authentication', ['NEXORA_BRAIN_API_KEY'], false),
    envCheck('powens', 'Open Banking provider', ['POWENS_CLIENT_ID', 'POWENS_API_KEY'], false),
    envCheck('resend', 'Transactional email', ['RESEND_API_KEY'], false),
  ];

  const level: ReadinessLevel = checks.some((c) => c.level === 'blocked')
    ? 'blocked'
    : checks.some((c) => c.level === 'warning')
      ? 'warning'
      : 'ready';

  return { level, checks, generatedAt: new Date().toISOString() };
}
